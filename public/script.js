/*
   ==============================================
   Photo Kiosk - Main Script (Firebase Version)
   ==============================================
*/

import { db, storage } from './js/firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import QRCode from "https://esm.sh/qrcode";

// --- 1. DOM Element Selection ---
const mainMenu = document.getElementById('main-menu');
const cameraView = document.getElementById('camera-view');
const photoSelection = document.getElementById('photo-selection');
const outputOptions = document.getElementById('output-options');

const startCameraButton = document.getElementById('start-camera');
const capturePhotoButton = document.getElementById('capture-photo');
const sendEmailButton = document.getElementById('send-email');
const retakePhotoButton = document.getElementById('retake-photo');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const framesContainerMain = document.getElementById('frames-container-main');
const finalPhoto = document.getElementById('final-photo');
const emailInput = document.getElementById('email');
const qrCodeContainer = document.getElementById('qr-code-container');
const frameOverlay = document.getElementById('frame-overlay');
const countdownOverlay = document.getElementById('countdown-overlay');
const flashOverlay = document.getElementById('flash-overlay');
const thumbnailsContainer = document.getElementById('thumbnails-container');

// --- 2. State Variables ---
let capturedPhotoDataUrl = null;
let selectedFrame = null; // Stores the frame object { name, url, ... }
let selectedFrameAspectRatio = 4 / 5;
let capturedPhotos = [];
let settings = { countdownDuration: 3, photoInterval: 2 };
let inactivityTimeout = null;
const DEFAULT_INACTIVITY_LIMIT = 60000; // 1 minute default

// --- 3. Core Functions ---

function showPrivacyNotice() {
    Swal.fire({
        title: 'Aviso de Privacidad',
        text: "Al tomar una foto, aceptas que puede ser utilizada en nuestras redes sociales y material promocional. ¡Sonríe!",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#0071BC',
        cancelButtonColor: '#555',
        confirmButtonText: 'Aceptar y Continuar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            startCamera();
        }
    });
}

async function startCamera() {
    mainMenu.classList.add('hidden');
    cameraView.classList.remove('hidden');

    if (selectedFrame) {
        frameOverlay.style.backgroundImage = `url('${selectedFrame.url}')`;
        const cameraWrapper = document.querySelector('.camera-wrapper');
        cameraWrapper.style.aspectRatio = `${selectedFrameAspectRatio}`;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Cámara',
            text: 'No se pudo acceder a la cámara. Asegúrate de haber otorgado los permisos necesarios.'
        });
        resetToMainMenu();
    }
}

async function captureAndProcessPhoto() {
    capturePhotoButton.disabled = true;

    // 1. Countdown
    countdownOverlay.classList.remove('hidden');
    for (let i = settings.countdownDuration; i > 0; i--) {
        countdownOverlay.textContent = i;
        await new Promise(r => setTimeout(r, 1000));
    }
    countdownOverlay.classList.add('hidden');

    // 2. Multi-Capture Loop
    capturedPhotos = [];
    for (let i = 0; i < 3; i++) {
        flashOverlay.classList.add('flash-active');
        setTimeout(() => flashOverlay.classList.remove('flash-active'), 200);

        const photoDataUrl = captureFrameToDataUrl();
        capturedPhotos.push(photoDataUrl);

        if (i < 2) {
            countdownOverlay.classList.remove('hidden');
            for (let j = settings.photoInterval; j > 0; j--) {
                countdownOverlay.textContent = j;
                await new Promise(r => setTimeout(r, 1000));
            }
            countdownOverlay.classList.add('hidden');
        }
    }

    showPhotoSelection();
}

function captureFrameToDataUrl() {
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const canvasAspectRatio = selectedFrameAspectRatio;
    let sWidth, sHeight, sx, sy;

    if (videoAspectRatio > canvasAspectRatio) {
        sHeight = video.videoHeight;
        sWidth = sHeight * canvasAspectRatio;
        sx = (video.videoWidth - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = video.videoWidth;
        sHeight = sWidth / canvasAspectRatio;
        sx = 0;
        sy = (video.videoHeight - sHeight) / 2;
    }

    canvas.width = 1080;
    canvas.height = 1080 / canvasAspectRatio;

    const context = canvas.getContext('2d');
    // Flip horizontally for mirror effect
    context.translate(canvas.width, 0);
    context.scale(-1, 1);

    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

    // Reset transform
    context.setTransform(1, 0, 0, 1, 0, 0);

    return canvas.toDataURL('image/png');
}

function showPhotoSelection() {
    cameraView.classList.add('hidden');
    photoSelection.classList.remove('hidden');
    thumbnailsContainer.innerHTML = '';

    capturedPhotos.forEach((photo, index) => {
        const img = document.createElement('img');
        img.src = photo;
        img.classList.add('thumbnail');
        img.onclick = () => selectFinalPhoto(photo);
        thumbnailsContainer.appendChild(img);
    });
}

async function selectFinalPhoto(photoDataUrl) {
    capturedPhotoDataUrl = photoDataUrl;
    photoSelection.classList.add('hidden');
    await processAndUploadPhoto();
}

async function processAndUploadPhoto() {
    try {
        Swal.fire({
            title: 'Procesando...',
            text: 'Aplicando marco y subiendo tu foto.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // 1. Load images
        const photoImg = await loadImage(capturedPhotoDataUrl);
        const frameImg = await loadImage(selectedFrame.url);

        // 2. Composite on Canvas
        canvas.width = photoImg.width;
        canvas.height = photoImg.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(photoImg, 0, 0);
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

        // 3. Convert to Blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // 4. Upload to Firebase Storage
        const filename = `photo-${Date.now()}.png`;
        const storageRef = ref(storage, `public/photos/${filename}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        // 5. Save Metadata to Firestore
        await addDoc(collection(db, "photos"), {
            name: filename,
            url: downloadURL,
            createdAt: new Date().toISOString()
        });

        Swal.close();

        // 6. Show Result
        cameraView.classList.add('hidden');
        outputOptions.classList.remove('hidden');
        finalPhoto.src = downloadURL;
        generateQrCode(downloadURL);

        // Start inactivity timer
        startInactivityTimer();

    } catch (error) {
        console.error("Error processing/uploading:", error);
        Swal.fire('¡Error!', 'No se pudo procesar la imagen.', 'error');
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function loadFramesForSelection() {
    try {
        const querySnapshot = await getDocs(collection(db, "frames"));
        framesContainerMain.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const frame = doc.data();
            // Only show available frames
            if (frame.available !== false) {
                const img = document.createElement('img');
                img.alt = frame.name;
                img.crossOrigin = "Anonymous"; // Important for canvas

                // Try loading from URL, fallback to local frames folder
                img.src = frame.url;
                img.onerror = function () {
                    if (!this.src.includes(`frames/${encodeURIComponent(frame.name)}`)) {
                        console.warn(`Failed to load frame from ${frame.url}, trying local fallback.`);
                        this.src = `frames/${frame.name}`;
                    }
                };

                img.addEventListener('click', () => selectFrame(img, frame));
                framesContainerMain.appendChild(img);
            }
        });
    } catch (error) {
        console.error("Error loading frames:", error);
    }
}

function selectFrame(imgElement, frameData) {
    document.querySelectorAll('#frames-container-main img').forEach(i => i.classList.remove('selected'));
    imgElement.classList.add('selected');

    // Hide carousel
    document.querySelector('.carousel-container').style.display = 'none';

    selectedFrame = frameData;

    if (imgElement.naturalWidth && imgElement.naturalHeight) {
        selectedFrameAspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;
    } else {
        selectedFrameAspectRatio = 4 / 5;
    }

    startCameraButton.disabled = false;
}

async function sendEmail() {
    const email = emailInput.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        Swal.fire('Correo Inválido', 'Por favor, ingresa una dirección de correo electrónico válida.', 'warning');
        return;
    }

    const sendingOverlay = document.getElementById('sending-overlay');
    const progressBar = document.querySelector('.progress-fill');
    sendingOverlay.classList.remove('hidden');
    progressBar.style.width = '0%';
    setTimeout(() => progressBar.style.width = '100%', 100);

    try {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Fake delay for UX

        let emailConfig = {
            senderName: "Photo Kiosk",
            subject: "Your Themed Photo!",
            htmlTemplate: "<p>Here is your photo!</p><img src='{{photoUrl}}' alt='photo'/>"
        };

        try {
            const configSnap = await getDoc(doc(db, "rules", "emailConfig"));
            if (configSnap.exists()) {
                emailConfig = configSnap.data();
            }
        } catch (e) {
            console.warn("Using default email config", e);
        }

        const response = await fetch('/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                photoUrl: finalPhoto.src,
                config: emailConfig
            })
        });
        const result = await response.json();

        sendingOverlay.classList.add('hidden');

        if (result.success) {
            // Log to Firestore
            try {
                await addDoc(collection(db, "emailLogs"), {
                    date: new Date().toISOString(),
                    email: email,
                    photoUrl: finalPhoto.src,
                    status: 'sent'
                });
            } catch (e) {
                console.error("Failed to log email", e);
            }
            Swal.fire('¡Correo Enviado!', 'Tu foto ha sido enviada exitosamente.', 'success');
        } else {
            throw new Error(result.message || 'Error desconocido.');
        }
    } catch (error) {
        sendingOverlay.classList.add('hidden');
        console.error("Error sending email:", error);
        Swal.fire('¡Error!', 'No se pudo enviar el correo.', 'error');
    }
}

async function generateQrCode(photoUrl) {
    try {
        const downloadUrl = `${window.location.origin}/download.html?photo=${encodeURIComponent(photoUrl)}`;
        const qrCodeDataUrl = await QRCode.toDataURL(downloadUrl);
        qrCodeContainer.innerHTML = `<img src="${qrCodeDataUrl}" alt="QR Code" />`;
    } catch (error) {
        console.error("Error generating QR code:", error);
        qrCodeContainer.innerHTML = '<p>No se pudo generar el código QR.</p>';
    }
}

function resetToMainMenu() {
    cameraView.classList.add('hidden');
    outputOptions.classList.add('hidden');
    photoSelection.classList.add('hidden');
    mainMenu.classList.remove('hidden');

    selectedFrame = null;
    capturedPhotoDataUrl = null;
    capturedPhotos = [];
    startCameraButton.disabled = true;
    capturePhotoButton.disabled = false;

    document.querySelectorAll('#frames-container-main img').forEach(i => i.classList.remove('selected'));
    qrCodeContainer.innerHTML = '';
    emailInput.value = '';
    frameOverlay.style.backgroundImage = 'none';

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    // Show carousel again
    document.querySelector('.carousel-container').style.display = 'block';

    // Clear timeout if exists
    if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
    }
}

function startInactivityTimer() {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    const timeoutDuration = (settings.inactivityTimeout || 60) * 1000;
    inactivityTimeout = setTimeout(() => {
        resetToMainMenu();
    }, timeoutDuration);
}

// --- 5. Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    loadFramesForSelection();

    // Load settings from Firestore
    try {
        const docRef = doc(db, "rules", "settings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            settings = docSnap.data();
        }
    } catch (e) {
        console.error("Failed to load settings from Firestore", e);
    }
});

// Event Listeners
startCameraButton.addEventListener('click', showPrivacyNotice);
capturePhotoButton.addEventListener('click', captureAndProcessPhoto);
sendEmailButton.addEventListener('click', sendEmail);
retakePhotoButton.addEventListener('click', resetToMainMenu);
