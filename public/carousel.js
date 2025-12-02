document.addEventListener('DOMContentLoaded', () => {
    const swiperWrapper = document.querySelector('.swiper-wrapper');

    const loadPhotos = async () => {
        try {
            const response = await fetch('/photos');
            if (!response.ok) {
                throw new Error('Failed to fetch photos');
            }
            const photos = await response.json();

            if (photos.length === 0) {
                swiperWrapper.innerHTML = '<p>No hay fotos disponibles en este momento.</p>';
                return;
            }

            let swiper; // Declare swiper instance variable

            photos.forEach(photoName => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';

                const polaroid = document.createElement('div');
                polaroid.className = 'polaroid';

                const img = document.createElement('img');
                img.src = `/photos/${photoName}`;
                img.alt = 'Foto del carrusel';

                polaroid.appendChild(img);
                slide.appendChild(polaroid);
                swiperWrapper.appendChild(slide);

                // Add click event listener for zoom effect
                polaroid.addEventListener('click', () => {
                    if (swiper && swiper.autoplay.running) {
                        swiper.autoplay.stop();
                        polaroid.classList.add('zoomed');

                        setTimeout(() => {
                            polaroid.classList.remove('zoomed');
                            swiper.autoplay.start();
                        }, 5000); // 5 seconds
                    }
                });
            });

            // Initialize Swiper with Premium Settings
            swiper = new Swiper('.swiper-container', {
                effect: 'coverflow',
                grabCursor: true,
                centeredSlides: true,
                slidesPerView: 'auto',
                initialSlide: 1, // Start a bit offset if needed, or 0
                coverflowEffect: {
                    rotate: 20, // Reduced rotation for cleaner look
                    stretch: 0,
                    depth: 200, // Increased depth for 3D feel
                    modifier: 1,
                    slideShadows: true,
                },
                loop: true,
                speed: 800, // Slower transition speed
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                autoplay: {
                    delay: 4000, // Slower autoplay
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true, // Pause when hovering
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
            swiperWrapper.innerHTML = '<p>Error al cargar la galería de fotos.</p>';
        }
    };

    loadPhotos();
});
