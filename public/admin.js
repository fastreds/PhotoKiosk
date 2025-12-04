
import { auth, db, storage } from './js/firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc, query, orderBy, limit, getDoc, startAfter, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import removeBackground from "https://esm.sh/@imgly/background-removal@1.4.5";

document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication ---
    const loginContainer = document.getElementById('login-container');
    const adminLayout = document.getElementById('admin-layout');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    const checkAuth = () => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loginContainer.classList.add('hidden');
                adminLayout.style.display = 'flex';
                loadData();
            } else {
                loginContainer.classList.remove('hidden');
                adminLayout.style.display = 'none';
                loginForm.reset();
                loginError.textContent = '';
            }
        });
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = 'Iniciando sesión...';

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                loginError.textContent = '';
            })
            .catch((error) => {
                console.error(error);
                loginError.textContent = 'Correo o contraseña inválidos.';
            });
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            // Sign-out successful.
        }).catch((error) => {
            console.error(error);
        });
    });

    // --- Sidebar Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            item.classList.add('active');
            const sectionId = item.dataset.section;
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // --- Frame Management ---
    const framesList = document.getElementById('frames-list');

    const loadFrames = async () => {
        framesList.innerHTML = '<p>Cargando marcos...</p>';
        try {
            const querySnapshot = await getDocs(collection(db, "frames"));
            framesList.innerHTML = '';
            querySnapshot.forEach((docSnap) => {
                const frame = docSnap.data();
                const item = document.createElement('div');
                item.className = 'frame-item';
                item.innerHTML = `
                    <img src="${frame.url}" alt="${frame.name}" crossorigin="anonymous" onerror="this.onerror=null; this.src='frames/${frame.name}';">
                    <p>${frame.name}</p>
                    <div class="frame-actions">
                        <label class="toggle-switch" style="justify-content: center; margin-bottom: 10px;">
                            <input type="checkbox" ${frame.available !== false ? 'checked' : ''} data-id="${docSnap.id}">
                            <span class="slider"></span>
                        </label>
                        <button class="btn-edit" data-id="${docSnap.id}" data-name="${frame.name}">Editar Nombre</button>
                        <button class="btn-delete" data-id="${docSnap.id}" data-name="${frame.name}">Eliminar</button>
                        <button class="btn-remove-bg" data-id="${docSnap.id}" data-url="${frame.url}">Quitar Fondo</button>
                    </div>
                `;
                framesList.appendChild(item);
            });
        } catch (e) {
            console.error(e);
            framesList.innerHTML = '<p>Error cargando marcos.</p>';
        }
    };

    framesList.addEventListener('click', async (event) => {
        const target = event.target;
        const frameId = target.dataset.id;

        if (!frameId) return;

        if (target.matches('input[type="checkbox"]')) {
            await updateDoc(doc(db, "frames", frameId), {
                available: target.checked
            });
        }

        if (target.matches('.btn-edit')) {
            const currentName = target.dataset.name;
            const extension = currentName.substring(currentName.lastIndexOf('.'));
            const nameWithoutExt = currentName.substring(0, currentName.lastIndexOf('.'));

            const { value: newName } = await Swal.fire({
                title: 'Editar Nombre del Marco',
                input: 'text',
                inputValue: nameWithoutExt,
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                cancelButtonText: 'Cancelar',
                inputValidator: (value) => {
                    if (!value) {
                        return '¡Debes escribir un nombre!';
                    }
                }
            });

            if (newName) {
                const finalName = newName + extension;
                try {
                    await updateDoc(doc(db, "frames", frameId), {
                        name: finalName
                    });
                    Swal.fire('¡Actualizado!', 'El nombre ha sido cambiado.', 'success');
                    loadFrames();
                } catch (e) {
                    Swal.fire('Error', e.message, 'error');
                }
            }
        }

        if (target.matches('.btn-delete')) {
            const frameName = target.dataset.name;
            Swal.fire({
                title: '¿Estás seguro?',
                text: "Esto eliminará permanentemente el marco.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonText: 'Cancelar',
                confirmButtonText: 'Sí, eliminar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const storageRef = ref(storage, `public/frames/${frameName}`);
                        await deleteObject(storageRef).catch(e => console.warn("File not found in storage", e));
                        await deleteDoc(doc(db, "frames", frameId));
                        Swal.fire('¡Eliminado!', 'El marco ha sido eliminado.', 'success');
                        loadFrames();
                    } catch (e) {
                        Swal.fire('Error', e.message, 'error');
                    }
                }
            });
        }

        if (target.matches('.btn-remove-bg')) {
            const frameUrl = target.dataset.url;
            Swal.fire({
                title: 'Procesando...',
                text: 'Quitando fondo (esto puede tardar un poco)...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await fetch(frameUrl);
                const blob = await response.blob();
                const newBlob = await removeBackground(blob);
                const docSnap = await getDoc(doc(db, "frames", frameId));
                const frameName = docSnap.data().name;
                const storageRef = ref(storage, `public/frames/${frameName}`);
                await uploadBytes(storageRef, newBlob);
                const newUrl = await getDownloadURL(storageRef);
                await updateDoc(doc(db, "frames", frameId), { url: newUrl });
                Swal.fire('¡Éxito!', 'Fondo eliminado.', 'success');
                loadFrames();
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Falló al quitar el fondo.', 'error');
            }
        }
    });

    const uploadFrameBtn = document.getElementById('upload-frame-btn');
    const frameUploadInput = document.getElementById('frame-upload-input');

    uploadFrameBtn.addEventListener('click', () => {
        frameUploadInput.click();
    });

    frameUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const storageRef = ref(storage, `public/frames/${file.name}`);
        try {
            Swal.fire({ title: 'Subiendo...', didOpen: () => Swal.showLoading() });
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await addDoc(collection(db, "frames"), {
                name: file.name,
                url: url,
                available: true,
                createdAt: new Date().toISOString()
            });
            Swal.fire('¡Éxito!', 'Marco subido.', 'success');
            loadFrames();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
        frameUploadInput.value = '';
    });

    // --- Photo Gallery (Enhanced) ---
    const photoGalleryList = document.getElementById('photo-gallery-list');
    const selectAllCheckbox = document.getElementById('gallery-select-all');
    const deleteSelectedBtn = document.getElementById('gallery-delete-selected');
    const prevPageBtn = document.getElementById('gallery-prev');
    const nextPageBtn = document.getElementById('gallery-next');
    const pageIndicator = document.getElementById('gallery-page-indicator');
    const previewModal = document.getElementById('preview-modal');
    const previewImage = document.getElementById('preview-image');
    const previewQr = document.getElementById('preview-qr');
    const closeModal = document.querySelector('.close-modal');

    let currentPage = 1;
    const pageSize = 20;
    let pageStack = []; // Stores the lastVisible doc of previous pages
    let lastVisible = null;
    let selectedPhotos = new Set();
    let currentPhotos = []; // Store current page photos for selection logic

    const loadPhotoGallery = async (direction = 'first') => {
        photoGalleryList.innerHTML = '<p>Cargando fotos...</p>';
        selectAllCheckbox.checked = false;
        selectedPhotos.clear();
        updateSelectionUI();

        try {
            let q;
            const photosRef = collection(db, "photos");

            if (direction === 'first') {
                q = query(photosRef, orderBy("createdAt", "desc"), limit(pageSize));
                pageStack = [];
                currentPage = 1;
            } else if (direction === 'next') {
                q = query(photosRef, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(pageSize));
                pageStack.push(lastVisible);
                currentPage++;
            } else if (direction === 'prev') {
                const prevLastVisible = pageStack.pop();
                // If popping brings us to empty stack, we are at page 1 (start from null/beginning)
                // But wait, pageStack[0] is end of page 1.
                // To go to Page 1, we query from start.
                // To go to Page 2, we startAfter(pageStack[0]).
                // So if we are at Page 3, stack has [endPage1, endPage2].
                // Pop endPage2. We want to startAfter endPage1.
                // If stack is empty after pop, we query from start.

                // Correction:
                // Page 1: Stack []
                // Click Next -> Stack [endPage1], Current Page 2. Query startAfter(endPage1).
                // Click Next -> Stack [endPage1, endPage2], Current Page 3. Query startAfter(endPage2).
                // Click Prev (at Page 3) -> Pop endPage2. Stack [endPage1]. Current Page 2. Query startAfter(endPage1).
                // Click Prev (at Page 2) -> Pop endPage1. Stack []. Current Page 1. Query from start.

                // Logic above modifies stack before query.
                // But 'prevLastVisible' is what we just popped (the end of the PREVIOUS page? No, the end of the page BEFORE the previous one? No.)

                // Let's restart logic:
                // Stack stores the 'startAfter' cursor for each page index.
                // Page 1: cursor null.
                // Page 2: cursor endPage1.
                // Stack: [null, endPage1, endPage2...]

                // Let's use a simpler stack approach.
                // When going Next, push current 'lastVisible' to stack.
                // When going Prev, pop from stack and use that as 'startAfter'.
                // But wait, if I am on Page 2, stack has [endPage1].
                // If I go Prev, I need to start from null. 
                // So stack should store the START cursor of the current page?

                // Let's stick to:
                // Page 1: Query start.
                // Page 2: Query startAfter(endPage1).
                // Stack will store the 'startAfter' param for the current page.
                // Page 1: Stack [null]
                // Next -> Page 2. Stack [null, endPage1].
                // Prev -> Pop. Stack [null]. Use null.

                // Re-implementing with this logic:
                // direction 'prev' means we pop the current page start, and peek the previous one.
                // Actually, simpler:
                // pageStack stores the start cursor for each page.
                // Init: pageStack = [null]
                // Next: push lastVisible (end of current page) to stack. Query startAfter(lastVisible).
                // Prev: pop current page start. Peek new top. Query startAfter(newTop).

                // Wait, if I am on Page 1, stack is [null].
                // Next: stack becomes [null, endPage1]. Query startAfter(endPage1).
                // Prev (from Page 2): pop endPage1. Stack is [null]. Query startAfter(null).

                // Correct.

                // However, I need to handle 'direction' arg properly.
                // If direction is 'first', stack = [null].
            }

            // Adjust logic based on direction
            if (direction === 'first') {
                pageStack = [null];
                currentPage = 1;
                q = query(photosRef, orderBy("createdAt", "desc"), limit(pageSize));
            } else if (direction === 'next') {
                pageStack.push(lastVisible);
                currentPage++;
                q = query(photosRef, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(pageSize));
            } else if (direction === 'prev') {
                pageStack.pop();
                currentPage--;
                const startCursor = pageStack[pageStack.length - 1];
                if (startCursor) {
                    q = query(photosRef, orderBy("createdAt", "desc"), startAfter(startCursor), limit(pageSize));
                } else {
                    q = query(photosRef, orderBy("createdAt", "desc"), limit(pageSize));
                }
            }

            const querySnapshot = await getDocs(q);

            // Update lastVisible for next iteration
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            // Update UI controls
            pageIndicator.textContent = `Página ${currentPage}`;
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = querySnapshot.empty || querySnapshot.docs.length < pageSize;

            photoGalleryList.innerHTML = '';
            currentPhotos = [];

            if (querySnapshot.empty) {
                photoGalleryList.innerHTML = '<p>No hay fotos.</p>';
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const photo = docSnap.data();
                currentPhotos.push({ id: docSnap.id, ...photo });

                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.dataset.id = docSnap.id;

                item.innerHTML = `
                    <input type="checkbox" class="gallery-checkbox" data-id="${docSnap.id}">
                    <img src="${photo.url}" loading="lazy" alt="Foto">
                `;

                // Click on item (except checkbox) opens preview
                item.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        openPreview(photo.url);
                    }
                });

                // Checkbox handling
                const checkbox = item.querySelector('.gallery-checkbox');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedPhotos.add(docSnap.id);
                        item.classList.add('selected');
                    } else {
                        selectedPhotos.delete(docSnap.id);
                        item.classList.remove('selected');
                    }
                    updateSelectionUI();
                });

                photoGalleryList.appendChild(item);
            });

        } catch (e) {
            console.error(e);
            photoGalleryList.innerHTML = '<p>Error cargando galería.</p>';
        }
    };

    const updateSelectionUI = () => {
        deleteSelectedBtn.disabled = selectedPhotos.size === 0;
        deleteSelectedBtn.textContent = selectedPhotos.size > 0 ? `Eliminar (${selectedPhotos.size})` : 'Eliminar Seleccionados';

        // Update Select All checkbox state
        const allSelected = currentPhotos.length > 0 && currentPhotos.every(p => selectedPhotos.has(p.id));
        selectAllCheckbox.checked = allSelected;
    };

    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.gallery-checkbox');

        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            const id = cb.dataset.id;
            const item = cb.closest('.gallery-item');

            if (isChecked) {
                selectedPhotos.add(id);
                item.classList.add('selected');
            } else {
                selectedPhotos.delete(id);
                item.classList.remove('selected');
            }
        });
        updateSelectionUI();
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedPhotos.size === 0) return;

        Swal.fire({
            title: '¿Estás seguro?',
            text: `Vas a eliminar ${selectedPhotos.size} fotos.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sí, eliminar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });

                const batch = writeBatch(db);
                const idsToDelete = Array.from(selectedPhotos);

                // Note: Firestore batch limit is 500. Assuming selection is within limits or we'd need to chunk.
                // Also need to delete from Storage.

                try {
                    const deletePromises = idsToDelete.map(async (id) => {
                        // Find photo data to get name for storage delete
                        // We might not have it if we didn't store it in 'currentPhotos' properly or if it's mixed.
                        // But we have 'currentPhotos' which are the ones displayed.
                        // Wait, selectedPhotos might contain IDs from previous pages if we kept selection across pages?
                        // For simplicity, let's assume selection clears on page change (implemented above).

                        const photo = currentPhotos.find(p => p.id === id);
                        if (photo) {
                            // Delete from Storage
                            const storageRef = ref(storage, `public/photos/${photo.name}`);
                            await deleteObject(storageRef).catch(e => console.warn("Storage delete failed", e));

                            // Add to batch
                            const docRef = doc(db, "photos", id);
                            batch.delete(docRef);
                        }
                    });

                    await Promise.all(deletePromises);
                    await batch.commit();

                    Swal.fire('¡Eliminado!', '', 'success');
                    loadPhotoGallery('first'); // Reload from start
                } catch (e) {
                    console.error(e);
                    Swal.fire('Error', 'Hubo un problema eliminando algunas fotos.', 'error');
                }
            }
        });
    });

    prevPageBtn.addEventListener('click', () => loadPhotoGallery('prev'));
    nextPageBtn.addEventListener('click', () => loadPhotoGallery('next'));

    // --- Preview Modal ---
    const openPreview = (url) => {
        previewImage.src = url;
        previewQr.innerHTML = ''; // Clear previous QR

        // Generate QR
        new QRCode(previewQr, {
            text: url,
            width: 150,
            height: 150
        });

        previewModal.classList.remove('hidden');
    };

    closeModal.addEventListener('click', () => {
        previewModal.classList.add('hidden');
    });

    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.add('hidden');
        }
    });


    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-theme');
            themeToggle.checked = false;
        }
    };
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);


    // --- Settings Management ---
    const countdownInput = document.getElementById('countdown-duration');
    const intervalInput = document.getElementById('photo-interval');
    const inactivityInput = document.getElementById('inactivity-timeout');
    const indexLimitInput = document.getElementById('index-carousel-limit');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    const loadSettings = async () => {
        try {
            const docSnap = await getDoc(doc(db, "rules", "settings"));
            if (docSnap.exists()) {
                const data = docSnap.data();
                countdownInput.value = data.countdownDuration;
                intervalInput.value = data.photoInterval;
                inactivityInput.value = data.inactivityTimeout || 60;
                indexLimitInput.value = data.indexCarouselLimit || 10;
            }
        } catch (e) { console.error(e); }
    };

    saveSettingsBtn.addEventListener('click', async () => {
        try {
            await setDoc(doc(db, "rules", "settings"), {
                countdownDuration: parseInt(countdownInput.value),
                photoInterval: parseInt(intervalInput.value),
                inactivityTimeout: parseInt(inactivityInput.value),
                indexCarouselLimit: parseInt(indexLimitInput.value)
            });
            Swal.fire('¡Éxito!', 'Configuración guardada.', 'success');
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });

    // --- Email Configuration ---
    const emailSenderInput = document.getElementById('email-sender-name');
    const emailSubjectInput = document.getElementById('email-subject');
    const emailTemplateInput = document.getElementById('email-template');
    const saveEmailConfigBtn = document.getElementById('save-email-config-btn');

    const loadEmailConfig = async () => {
        try {
            const docSnap = await getDoc(doc(db, "rules", "emailConfig"));
            if (docSnap.exists()) {
                const data = docSnap.data();
                emailSenderInput.value = data.senderName;
                emailSubjectInput.value = data.subject;
                emailTemplateInput.value = data.htmlTemplate;
            }
        } catch (e) { console.error(e); }
    };

    saveEmailConfigBtn.addEventListener('click', async () => {
        try {
            await setDoc(doc(db, "rules", "emailConfig"), {
                senderName: emailSenderInput.value,
                subject: emailSubjectInput.value,
                htmlTemplate: emailTemplateInput.value
            });
            Swal.fire('¡Éxito!', 'Configuración de correo guardada.', 'success');
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });

    // --- Email Logs ---
    const emailLogsTableBody = document.querySelector('#email-logs-table tbody');
    const loadEmailLogs = async () => {
        try {
            const q = query(collection(db, "emailLogs"), orderBy("date", "desc"), limit(50));
            const querySnapshot = await getDocs(q);
            emailLogsTableBody.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(log.date).toLocaleString()}</td>
                    <td>${log.email}</td>
                    <td>${log.status}</td>
                    <td>
                         <button class="btn-primary btn-resend" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" data-email="${log.email}" data-photo="${log.photoUrl}">Reenviar</button>
                    </td>
                `;
                emailLogsTableBody.appendChild(row);
            });

            document.querySelectorAll('.btn-resend').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    const photoUrl = e.target.dataset.photo;
                    try {
                        const response = await fetch('/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, photoUrl })
                        });
                        if (response.ok) Swal.fire('Enviado', '', 'success');
                        else Swal.fire('Error', 'Falló el envío', 'error');
                    } catch (err) { console.error(err); }
                });
            });

        } catch (e) {
            console.error("Error loading logs", e);
            emailLogsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error cargando registros: ${e.message}</td></tr>`;
        }
    };

    const loadData = () => {
        loadFrames();
        loadSettings();
        loadEmailConfig();
        loadEmailLogs();
        loadPhotoGallery('first');
    };

    checkAuth();
});
