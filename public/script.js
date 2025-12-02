/*
   ==============================================
   Photo Kiosk - Main Script (Spanish Version)
   ==============================================
*/

// --- 1. DOM Element Selection ---
const mainMenu = document.getElementById('main-menu');
const cameraView = document.getElementById('camera-view');
const photoSelection = document.getElementById('photo-selection'); // New view
const outputOptions = document.getElementById('output-options');

const startCameraButton = document.getElementById('start-camera');
const capturePhotoButton = document.getElementById('capture-photo');
const sendEmailButton = document.getElementById('send-email');
const getQrButton = document.getElementById('get-qr');
const retakePhotoButton = document.getElementById('retake-photo'); // New button

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const framesContainerMain = document.getElementById('frames-container-main'); // Updated container
const finalPhoto = document.getElementById('final-photo');
const emailInput = document.getElementById('email');
const qrCodeContainer = document.getElementById('qr-code-container');
const frameOverlay = document.getElementById('frame-overlay');
const countdownOverlay = document.getElementById('countdown-overlay'); // New element
const flashOverlay = document.getElementById('flash-overlay'); // New element
const thumbnailsContainer = document.getElementById('thumbnails-container'); // New element

// --- 2. State Variables ---
let capturedPhotoDataUrl = null;
let selectedFrame = null;
let selectedFrameAspectRatio = 4 / 5; // Default aspect ratio
let capturedPhotos = []; // Array to store multiple shots
let settings = { countdownDuration: 3, photoInterval: 2 }; // Default settings

// --- 3. Core Functions ---

/**
 * Displays a privacy notice before starting the camera.
 */
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

/**
 * Initializes and starts the camera stream.
 */
async function startCamera() {
    mainMenu.classList.add('hidden');
    cameraView.classList.remove('hidden');
    // Apply the selected frame to the overlay
    if (selectedFrame) {
        frameOverlay.style.backgroundImage = `url('/frames/${selectedFrame}')`;

        // Update camera wrapper aspect ratio
        const cameraWrapper = document.querySelector('.camera-wrapper');
        cameraWrapper.style.aspectRatio = `${selectedFrameAspectRatio}`;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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

/**
 * Captures a photo from the video stream, crops it, and sends it to the server.
 */
/**
 * Captures a sequence of photos with a countdown.
 */
async function captureAndProcessPhoto() {
    // Disable button to prevent multiple clicks
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
        // Flash effect
        flashOverlay.classList.add('flash-active');
        setTimeout(() => flashOverlay.classList.remove('flash-active'), 200);

        // Capture frame
        const photoDataUrl = captureFrameToDataUrl();
        capturedPhotos.push(photoDataUrl);

        // Wait interval (except after last photo)
        if (i < 2) {
            countdownOverlay.classList.remove('hidden');
            // Mini countdown for the interval
            for (let j = settings.photoInterval; j > 0; j--) {
                countdownOverlay.textContent = j;
                await new Promise(r => setTimeout(r, 1000));
            }
            countdownOverlay.classList.add('hidden');
        }
    }

    // 3. Show Selection UI
    showPhotoSelection();
}

function captureFrameToDataUrl() {
    // --- Aspect Ratio Cropping Logic ---
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

    // --- Canvas Drawing ---
    canvas.width = 1080;
    canvas.height = 1080 / canvasAspectRatio;

    const context = canvas.getContext('2d');
    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
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
    await sendPhotoToServer();
}

/**
 * Sends the captured photo and selected frame to the server for processing.
 */
async function sendPhotoToServer() {
    try {
        const photoBlob = await (await fetch(capturedPhotoDataUrl)).blob();
        const formData = new FormData();
        formData.append('photo', photoBlob, 'photo.png');
        formData.append('frame', selectedFrame);

        Swal.fire({
            title: 'Procesando tu foto...',
            text: 'Aplicando el marco y preparando todo.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch('/capture', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);

        const result = await response.json();
        Swal.close();

        if (result.success) {
            cameraView.classList.add('hidden');
            outputOptions.classList.remove('hidden');
            finalPhoto.src = result.url;
            generateQrCode(); // Generate QR immediately
        } else {
            throw new Error(result.message || 'Error desconocido durante el procesamiento.');
        }
    } catch (error) {
        console.error("Error sending photo to server:", error);
        Swal.fire('¡Error!', 'No se pudo procesar la imagen. Por favor, intenta de nuevo.', 'error');
    }
}

/**
 * Fetches available frames from the server and displays them in the main menu.
 */
async function loadFramesForSelection() {
    try {
        const response = await fetch('/frames');
        const frames = await response.json();
        framesContainerMain.innerHTML = ''; // Clear existing frames
        frames.forEach(frame => {
            const img = document.createElement('img');
            img.src = `/frames/${frame}`;
            img.alt = `Marco ${frame}`;
            img.addEventListener('click', () => selectFrame(img, frame));
            framesContainerMain.appendChild(img);
        });
    } catch (error) {
        console.error("Error loading frames:", error);
    }
}

/**
 * Handles the selection of a frame in the main menu.
 * @param {HTMLImageElement} imgElement - The clicked image element.
 * @param {string} frameName - The name of the selected frame file.
 */
function selectFrame(imgElement, frameName) {
    document.querySelectorAll('#frames-container-main img').forEach(i => i.classList.remove('selected'));
    imgElement.classList.add('selected');
    selectedFrame = frameName;

    const updateAspectRatio = () => {
        if (imgElement.naturalWidth && imgElement.naturalHeight) {
            selectedFrameAspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;
        } else {
            selectedFrameAspectRatio = 4 / 5; // Fallback
        }
        console.log(`Frame selected: ${frameName}, Aspect Ratio: ${selectedFrameAspectRatio}`);
    };

    if (imgElement.complete) {
        updateAspectRatio();
    } else {
        imgElement.onload = updateAspectRatio;
    }

    startCameraButton.disabled = false; // Enable the camera button
}

/**
 * Sends the final photo to the specified email address.
 */
async function sendEmail() {
    const email = emailInput.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        Swal.fire('Correo Inválido', 'Por favor, ingresa una dirección de correo electrónico válida.', 'warning');
        return;
    }

    // Show animation
    const sendingOverlay = document.getElementById('sending-overlay');
    const progressBar = document.querySelector('.progress-fill');
    sendingOverlay.classList.remove('hidden');
    progressBar.style.width = '0%';

    // Animate progress bar over 5 seconds
    setTimeout(() => progressBar.style.width = '100%', 100);

    try {
        // Wait 5 seconds for animation effect
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch('/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, photoUrl: finalPhoto.src })
        });
        const result = await response.json();

        sendingOverlay.classList.add('hidden');

        if (result.success) {
            Swal.fire('¡Correo Enviado!', 'Tu foto ha sido enviada exitosamente.', 'success');
        } else {
            throw new Error(result.message || 'Error desconocido al enviar el correo.');
        }
    } catch (error) {
        sendingOverlay.classList.add('hidden');
        console.error("Error sending email:", error);
        Swal.fire('¡Error!', 'No se pudo enviar el correo. Por favor, intenta de nuevo.', 'error');
    }
}

/**
 * Generates and displays a QR code for the final photo.
 */
async function generateQrCode() {
    try {
        // Point to the download page instead of the direct image
        const downloadUrl = `${window.location.origin}/download.html?photo=${encodeURIComponent(finalPhoto.src)}`;
        // Use a QR code API that returns an image directly or use the backend
        // Here we use the backend endpoint but pass the download URL
        const response = await fetch(`/qr-code?photoUrl=${encodeURIComponent(downloadUrl)}`);
        if (!response.ok) throw new Error('Failed to fetch QR code.');
        const qrCodeHtml = await response.text();
        qrCodeContainer.innerHTML = qrCodeHtml;
    } catch (error) {
        console.error("Error generating QR code:", error);
        qrCodeContainer.innerHTML = '<p>No se pudo generar el código QR.</p>';
    }
}

/**
 * Resets the UI to the main menu to start over.
 */
function resetToMainMenu() {
    // Hide other views
    cameraView.classList.add('hidden');
    outputOptions.classList.add('hidden');
    photoSelection.classList.add('hidden');

    // Show main menu
    mainMenu.classList.remove('hidden');

    // Reset state
    selectedFrame = null;
    capturedPhotoDataUrl = null;
    capturedPhotos = [];
    startCameraButton.disabled = true;
    capturePhotoButton.disabled = false;

    // Clear dynamic content
    document.querySelectorAll('#frames-container-main img').forEach(i => i.classList.remove('selected'));
    qrCodeContainer.innerHTML = '';
    emailInput.value = '';
    frameOverlay.style.backgroundImage = 'none';

    // Stop any active camera stream
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

// --- 4. Event Listeners ---
startCameraButton.addEventListener('click', showPrivacyNotice);
capturePhotoButton.addEventListener('click', captureAndProcessPhoto);
sendEmailButton.addEventListener('click', sendEmail);
// getQrButton.addEventListener('click', generateQrCode); // Removed button
retakePhotoButton.addEventListener('click', resetToMainMenu);

// --- 5. Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    loadFramesForSelection();
    // Load settings
    try {
        const response = await fetch('/settings');
        const data = await response.json();
        settings = data;
    } catch (e) {
        console.error("Failed to load settings", e);
    }
});
