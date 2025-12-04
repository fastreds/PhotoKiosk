
import { auth, db, storage } from './js/firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc, query, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import removeBackground from "https://esm.sh/@imgly/background-removal@1.4.5";

document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication ---
    const loginContainer = document.getElementById('login-container');
    const adminContent = document.getElementById('admin-content');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    const checkAuth = () => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loginContainer.classList.add('hidden');
                adminContent.style.display = 'block';
                loadData();
            } else {
                loginContainer.classList.remove('hidden');
                adminContent.style.display = 'none';
                loginForm.reset();
                loginError.textContent = '';
            }
        });
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = 'Logging in...';

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                // Success is handled by onAuthStateChanged
                loginError.textContent = '';
            })
            .catch((error) => {
                console.error(error);
                loginError.textContent = 'Invalid email or password.';
            });
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            // Sign-out successful.
        }).catch((error) => {
            // An error happened.
            console.error(error);
        });
    });

    // --- Frame Management ---
    const framesList = document.getElementById('frames-list');

    const loadFrames = async () => {
        framesList.innerHTML = '<p>Loading frames...</p>';
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
                        <label class="toggle-switch">
                            <span>Available</span>
                            <input type="checkbox" ${frame.available !== false ? 'checked' : ''} data-id="${docSnap.id}">
                            <span class="slider"></span>
                        </label>
                        <button class="btn-delete" data-id="${docSnap.id}" data-name="${frame.name}">Delete</button>
                        <button class="btn-remove-bg" data-id="${docSnap.id}" data-url="${frame.url}">Remove BG</button>
                    </div>
                `;
                framesList.appendChild(item);
            });
        } catch (e) {
            console.error(e);
            framesList.innerHTML = '<p>Error loading frames.</p>';
        }
    };

    framesList.addEventListener('click', async (event) => {
        const target = event.target;
        const frameId = target.dataset.id;

        if (!frameId) return;

        // Toggle availability
        if (target.matches('input[type="checkbox"]')) {
            await updateDoc(doc(db, "frames", frameId), {
                available: target.checked
            });
        }

        // Delete frame
        if (target.matches('.btn-delete')) {
            const frameName = target.dataset.name;
            Swal.fire({
                title: 'Are you sure?',
                text: "This will permanently delete the frame.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d9534f',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        // Delete from Storage
                        const storageRef = ref(storage, `public/frames/${frameName}`);
                        await deleteObject(storageRef).catch(e => console.warn("File not found in storage", e));

                        // Delete from Firestore
                        await deleteDoc(doc(db, "frames", frameId));

                        Swal.fire('Deleted!', 'The frame has been deleted.', 'success');
                        loadFrames();
                    } catch (e) {
                        Swal.fire('Error!', e.message, 'error');
                    }
                }
            });
        }

        // Remove background
        if (target.matches('.btn-remove-bg')) {
            const frameUrl = target.dataset.url;
            Swal.fire({
                title: 'Processing...',
                text: 'Removing background (this may take a while)...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                // 1. Fetch the image as blob
                const response = await fetch(frameUrl);
                const blob = await response.blob();

                // 2. Remove background
                const newBlob = await removeBackground(blob);

                // 3. Upload back to Storage (overwrite)
                // We need the filename. Assuming we can get it from the URL or metadata, 
                // but simpler to just use the name from the list if we had it.
                // Let's re-fetch the doc to get the name to be sure.
                const docSnap = await getDoc(doc(db, "frames", frameId));
                const frameName = docSnap.data().name;

                const storageRef = ref(storage, `public/frames/${frameName}`);
                await uploadBytes(storageRef, newBlob);

                // 4. Update Firestore (url might change if token changes, but usually same path)
                const newUrl = await getDownloadURL(storageRef);
                await updateDoc(doc(db, "frames", frameId), { url: newUrl });

                Swal.fire('Success!', 'Background removed.', 'success');
                loadFrames();
            } catch (e) {
                console.error(e);
                Swal.fire('Error!', 'Failed to remove background.', 'error');
            }
        }
    });

    // --- Frame Uploader ---
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
            Swal.fire({ title: 'Uploading...', didOpen: () => Swal.showLoading() });
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            await addDoc(collection(db, "frames"), {
                name: file.name,
                url: url,
                available: true,
                createdAt: new Date().toISOString()
            });

            Swal.fire('Success!', 'Frame uploaded.', 'success');
            loadFrames();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
        frameUploadInput.value = '';

    });

    // --- Repair Frames ---
    const repairFramesBtn = document.getElementById('repair-frames-btn');
    repairFramesBtn.addEventListener('click', async () => {
        Swal.fire({
            title: 'Repairing Frames...',
            text: 'This will re-upload all frames from the local "frames" folder to Firebase Storage and update the database. This fixes broken URLs.',
            showCancelButton: true,
            confirmButtonText: 'Start Repair',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    // 1. Get all frames from Firestore
                    const querySnapshot = await getDocs(collection(db, "frames"));
                    const frames = [];
                    querySnapshot.forEach(doc => frames.push({ id: doc.id, ...doc.data() }));

                    for (const frame of frames) {
                        const frameName = frame.name;
                        const localUrl = `frames/${frameName}`;

                        try {
                            // 2. Fetch local file
                            const response = await fetch(localUrl);
                            if (!response.ok) throw new Error(`Local file not found: ${localUrl}`);
                            const blob = await response.blob();

                            // 3. Upload to Storage
                            const storageRef = ref(storage, `public/frames/${frameName}`);
                            await uploadBytes(storageRef, blob);
                            const newUrl = await getDownloadURL(storageRef);

                            // 4. Update Firestore
                            await updateDoc(doc(db, "frames", frame.id), { url: newUrl });
                            console.log(`Repaired ${frameName}`);
                        } catch (err) {
                            console.error(`Failed to repair ${frameName}:`, err);
                        }
                    }
                    return true;
                } catch (error) {
                    Swal.showValidationMessage(`Request failed: ${error}`);
                }
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Finished!', 'Frames have been repaired.', 'success');
                loadFrames();
            }
        });
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
            Swal.fire('Success', 'Settings saved.', 'success');
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
            Swal.fire('Success', 'Email config saved.', 'success');
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });

    // --- Email Logs ---
    const emailLogsTableBody = document.querySelector('#email-logs-table tbody');
    const loadEmailLogs = async () => {
        // This might be better served by a real-time listener or just a fetch
        // Since we are moving logic to client, we can read from Firestore if we save logs there.
        // But currently server saves to local JSON.
        // We should update server to save to Firestore? Or just read from the server endpoint?
        // The server endpoint /admin/emails reads from local JSON.
        // If we want to fully migrate, we should make the server write to Firestore or have the client write to Firestore when sending email?
        // Client calls /send-email. Server sends email. Server should probably log to Firestore.
        // For now, let's assume we will update server to log to Firestore or we just read from Firestore here.

        // Let's try to read from Firestore 'emailLogs' collection
        try {
            const q = query(collection(db, "emailLogs"), orderBy("date", "desc"), limit(50));
            const querySnapshot = await getDocs(q);
            emailLogsTableBody.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 10px;">${new Date(log.date).toLocaleString()}</td>
                    <td style="padding: 10px;">${log.email}</td>
                    <td style="padding: 10px;">${log.status}</td>
                    <td style="padding: 10px;">
                         <button class="btn-resend" data-email="${log.email}" data-photo="${log.photoUrl}">Resend</button>
                    </td>
                `;
                emailLogsTableBody.appendChild(row);
            });

            // Add event listeners to resend buttons
            document.querySelectorAll('.btn-resend').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    const photoUrl = e.target.dataset.photo;
                    // Call server endpoint
                    try {
                        const response = await fetch('/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, photoUrl })
                        });
                        if (response.ok) Swal.fire('Sent', '', 'success');
                        else Swal.fire('Error', 'Failed', 'error');
                    } catch (err) { console.error(err); }
                });
            });

        } catch (e) {
            console.error("Error loading logs", e);
            emailLogsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error loading logs: ${e.message} (Check Firestore Rules)</td></tr>`;
        }
    };

    // --- Photo Gallery ---
    const photoGalleryList = document.getElementById('photo-gallery-list');
    const loadPhotoGallery = async () => {
        try {
            const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(50));
            const querySnapshot = await getDocs(q);
            photoGalleryList.innerHTML = '';
            querySnapshot.forEach((docSnap) => {
                const photo = docSnap.data();
                const photoCard = document.createElement('div');
                photoCard.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; overflow: hidden; text-align: center; background: #fff;';

                const img = document.createElement('img');
                img.src = photo.url;
                img.style.cssText = 'width: 100%; height: 150px; object-fit: cover;';

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.cssText = 'background: #ff4444; color: white; border: none; padding: 5px 10px; margin: 10px; cursor: pointer; border-radius: 4px;';

                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Delete this photo?')) {
                        try {
                            // Delete from Storage
                            const storageRef = ref(storage, `public/photos/${photo.name}`);
                            await deleteObject(storageRef).catch(e => console.warn(e));
                            // Delete from Firestore
                            await deleteDoc(doc(db, "photos", docSnap.id));
                            loadPhotoGallery();
                        } catch (e) { console.error(e); }
                    }
                });

                photoCard.appendChild(img);
                photoCard.appendChild(deleteBtn);
                photoGalleryList.appendChild(photoCard);
            });
        } catch (e) { console.error(e); }
    };

    const loadData = () => {
        loadFrames();
        loadSettings();
        loadEmailConfig();
        loadEmailLogs();
        loadPhotoGallery();
    };

    // Initial check
    checkAuth();
});
