
import { db } from './js/firebase-config.js';
import { collection, getDocs, query, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import QRCode from "https://esm.sh/qrcode";

document.addEventListener('DOMContentLoaded', async () => {
    const swiperWrapper = document.querySelector('.swiper-wrapper');
    let inactivityTimeout = null;
    let settings = { inactivityTimeout: 60 };

    // Load settings
    try {
        const settingsSnap = await getDoc(doc(db, "rules", "settings"));
        if (settingsSnap.exists()) {
            settings = { ...settings, ...settingsSnap.data() };
        }
    } catch (e) {
        console.warn("Failed to load settings", e);
    }

    const startInactivityTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        const timeoutDuration = (settings.inactivityTimeout || 60) * 1000;
        inactivityTimeout = setTimeout(() => {
            window.location.href = '/';
        }, timeoutDuration);
    };

    const resetInactivityTimer = () => {
        startInactivityTimer();
    };

    // Initial timer start
    startInactivityTimer();

    // Reset timer on interactions
    document.addEventListener('click', resetInactivityTimer);
    document.addEventListener('touchstart', resetInactivityTimer);
    document.addEventListener('mousemove', resetInactivityTimer);

    const loadPhotos = async () => {
        try {
            const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(25));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                swiperWrapper.innerHTML = '<p style="color:white; text-align:center; width:100%;">No hay fotos disponibles en este momento.</p>';
                return;
            }

            let swiper;

            querySnapshot.forEach((doc) => {
                const photo = doc.data();
                const photoUrl = photo.url;

                const slide = document.createElement('div');
                slide.className = 'swiper-slide';

                const polaroid = document.createElement('div');
                polaroid.className = 'polaroid';

                const img = document.createElement('img');
                img.src = photoUrl;
                img.alt = 'Foto del carrusel';
                img.loading = 'lazy';

                polaroid.appendChild(img);
                slide.appendChild(polaroid);
                swiperWrapper.appendChild(slide);

                // Click event for QR Code Modal
                polaroid.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent swiper click issues if any
                    resetInactivityTimer(); // Reset timer explicitly

                    // Generate QR Code
                    const downloadUrl = `${window.location.origin}/download.html?photo=${encodeURIComponent(photoUrl)}`;
                    let qrCodeDataUrl = '';
                    try {
                        qrCodeDataUrl = await QRCode.toDataURL(downloadUrl);
                    } catch (err) {
                        console.error("QR Gen Error", err);
                    }

                    Swal.fire({
                        title: '¡Tu Recuerdo!',
                        html: `
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                                <img src="${photoUrl}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                                <div style="text-align: center;">
                                    <p style="margin-bottom: 5px; font-weight: bold;">Escanea para descargar:</p>
                                    <img src="${qrCodeDataUrl}" style="width: 150px; height: 150px;">
                                </div>
                            </div>
                        `,
                        showCloseButton: true,
                        showConfirmButton: false,
                        width: 600,
                        padding: '2em',
                        background: '#fff',
                        backdrop: `rgba(0,0,0,0.8)`
                    }).then(() => {
                        resetInactivityTimer();
                    });
                });
            });

            // Initialize Swiper
            swiper = new Swiper('.swiper-container', {
                effect: 'coverflow',
                grabCursor: true,
                centeredSlides: true,
                slidesPerView: 'auto',
                initialSlide: 0,
                coverflowEffect: {
                    rotate: 20,
                    stretch: 0,
                    depth: 200,
                    modifier: 1,
                    slideShadows: true,
                },
                loop: querySnapshot.size > 3, // Only loop if enough slides
                speed: 800,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                autoplay: {
                    delay: 4000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                },
                keyboard: {
                    enabled: true,
                },
                mousewheel: {
                    thresholdDelta: 50,
                    sensitivity: 1,
                },
            });

        } catch (error) {
            console.error('Error loading photos:', error);
            swiperWrapper.innerHTML = '<p style="color:white;">Error al cargar la galería de fotos.</p>';
        }
    };

    loadPhotos();
});
