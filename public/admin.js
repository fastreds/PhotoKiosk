document.addEventListener('DOMContentLoaded', () => {
    // --- Password Protection ---
    const checkPassword = () => {
        const password = sessionStorage.getItem('adminPassword');
        if (password === 'admin123') {
            document.getElementById('admin-content').style.display = 'block';
        } else {
            askForPassword();
        }
    };

    const askForPassword = () => {
        Swal.fire({
            title: 'Admin Access',
            input: 'password',
            inputPlaceholder: 'Enter your password',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            allowOutsideClick: false,
            allowEscapeKey: false,
            showCancelButton: true,
            confirmButtonText: 'Log in',
            cancelButtonText: 'Back to Kiosk',
        }).then((result) => {
            if (result.isConfirmed) {
                if (result.value === 'admin123') {
                    sessionStorage.setItem('adminPassword', result.value);
                    document.getElementById('admin-content').style.display = 'block';
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Incorrect Password',
                        text: 'Please try again.'
                    }).then(askForPassword);
                }
            } else {
                window.location.href = '/';
            }
        });
    };

    // --- Frame Management ---
    const framesList = document.getElementById('frames-list');

    const loadFrames = async () => {
        const response = await fetch('/admin/frames');
        const frames = await response.json();
        framesList.innerHTML = '';

        frames.forEach(frame => {
            const item = document.createElement('div');
            item.className = 'frame-item';
            item.innerHTML = `
                <img src="/frames/${frame.name}" alt="${frame.name}">
                <p>${frame.name}</p>
                <div class="frame-actions">
                    <label class="toggle-switch">
                        <span>Available</span>
                        <input type="checkbox" ${frame.available ? 'checked' : ''} data-name="${frame.name}">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-edit" data-name="${frame.name}">Edit</button>
                    <button class="btn-delete" data-name="${frame.name}">Delete</button>
                    <button class="btn-remove-bg" data-name="${frame.name}">Remove BG</button>
                </div>
            `;
            framesList.appendChild(item);
        });
    };

    framesList.addEventListener('click', async (event) => {
        const target = event.target;
        const frameName = target.dataset.name;

        if (!frameName) return;

        // Toggle availability
        if (target.matches('input[type="checkbox"]')) {
            await fetch('/admin/toggle-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: frameName })
            });
        }

        // Delete frame
        if (target.matches('.btn-delete')) {
            Swal.fire({
                title: 'Are you sure?',
                text: `This will permanently delete ${frameName}. You won't be able to revert this!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d9534f',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const response = await fetch('/admin/delete-frame', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: frameName })
                    });
                    if (response.ok) {
                        Swal.fire('Deleted!', 'The frame has been deleted.', 'success');
                        loadFrames();
                    } else {
                        Swal.fire('Error!', 'Could not delete the frame.', 'error');
                    }
                }
            });
        }

        // Remove background
        if (target.matches('.btn-remove-bg')) {
            Swal.fire({
                title: 'Processing...',
                text: 'Removing background from the frame. Please wait.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch('/admin/remove-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: frameName })
            });

            if (response.ok) {
                Swal.fire('Success!', 'Background removed successfully.', 'success');
                loadFrames(); // Recargar para ver el cambio
            } else {
                Swal.fire('Error!', 'Could not remove the background.', 'error');
            }
        }

        // Edit frame
        if (target.matches('.btn-edit')) {
            const { value: file } = await Swal.fire({
                title: `Update ${frameName}`,
                text: 'Upload a new PNG file to replace the existing frame.',
                input: 'file',
                inputAttributes: {
                    'accept': 'image/png',
                    'aria-label': 'Upload your frame'
                },
                showCancelButton: true,
                confirmButtonText: 'Upload'
            });

            if (file) {
                const formData = new FormData();
                // Use the original frame name to overwrite it
                formData.append('frame', file, frameName);

                const response = await fetch('/save-frame', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Frame updated successfully.', 'success');
                    loadFrames(); // Refresh to show the new image
                } else {
                    Swal.fire('Error!', 'Could not update the frame.', 'error');
                }
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

        const formData = new FormData();
        formData.append('frame', file, file.name);

        const response = await fetch('/save-frame', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            Swal.fire('Success!', 'Frame uploaded successfully.', 'success');
            loadFrames(); // Refresh the list
        } else {
            Swal.fire('Error', 'Could not upload the frame.', 'error');
        }
        frameUploadInput.value = '';
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

    const loadTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);
    };

    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- Settings Management ---
    const countdownInput = document.getElementById('countdown-duration');
    const intervalInput = document.getElementById('photo-interval');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    const loadSettings = async () => {
        try {
            const response = await fetch('/settings');
            const settings = await response.json();
            countdownInput.value = settings.countdownDuration;
            intervalInput.value = settings.photoInterval;
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    };

    saveSettingsBtn.addEventListener('click', async () => {
        const settings = {
            countdownDuration: countdownInput.value,
            photoInterval: intervalInput.value
        };

        try {
            const response = await fetch('/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const result = await response.json();
            if (result.success) {
                Swal.fire('Success!', 'Settings saved successfully.', 'success');
            } else {
                Swal.fire('Error!', 'Could not save settings.', 'error');
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            Swal.fire('Error!', 'An error occurred.', 'error');
        }
    });

    // --- Email Management ---
    const emailSenderInput = document.getElementById('email-sender-name');
    const emailSubjectInput = document.getElementById('email-subject');
    const emailTemplateInput = document.getElementById('email-template');
    const saveEmailConfigBtn = document.getElementById('save-email-config-btn');
    const emailLogsTableBody = document.querySelector('#email-logs-table tbody');

    const loadEmailConfig = async () => {
        try {
            const response = await fetch('/admin/email-config');
            const config = await response.json();
            emailSenderInput.value = config.senderName;
            emailSubjectInput.value = config.subject;
            emailTemplateInput.value = config.htmlTemplate;
        } catch (error) {
            console.error("Error loading email config:", error);
        }
    };

    saveEmailConfigBtn.addEventListener('click', async () => {
        const config = {
            senderName: emailSenderInput.value,
            subject: emailSubjectInput.value,
            htmlTemplate: emailTemplateInput.value
        };

        try {
            const response = await fetch('/admin/email-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (response.ok) {
                Swal.fire('Success!', 'Email configuration saved.', 'success');
            } else {
                Swal.fire('Error!', 'Could not save configuration.', 'error');
            }
        } catch (error) {
            console.error("Error saving email config:", error);
        }
    });

    const loadEmailLogs = async () => {
        try {
            const response = await fetch('/admin/emails');
            const logs = await response.json();
            emailLogsTableBody.innerHTML = '';

            logs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(log.date).toLocaleString()}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${log.email}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${log.status}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                        <button class="btn-resend" data-email="${log.email}" data-photo="${log.photoUrl}" style="padding: 5px 10px; cursor: pointer;">Resend</button>
                    </td>
                `;
                emailLogsTableBody.appendChild(row);
            });

            // Add event listeners to resend buttons
            document.querySelectorAll('.btn-resend').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    const photoUrl = e.target.dataset.photo;

                    Swal.fire({
                        title: 'Resending...',
                        didOpen: () => Swal.showLoading()
                    });

                    try {
                        const response = await fetch('/admin/resend-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, photoUrl })
                        });
                        if (response.ok) {
                            Swal.fire('Success!', 'Email resent successfully.', 'success');
                            loadEmailLogs(); // Refresh logs
                        } else {
                            Swal.fire('Error!', 'Failed to resend email.', 'error');
                        }
                    } catch (error) {
                        console.error("Error resending email:", error);
                        Swal.fire('Error!', 'An error occurred.', 'error');
                    }
                });
            });

        } catch (error) {
            console.error("Error loading email logs:", error);
        }
    };

    // --- Photo Gallery Maintenance ---
    const photoGalleryList = document.getElementById('photo-gallery-list');

    const loadPhotoGallery = async () => {
        try {
            const response = await fetch('/photos');
            const photos = await response.json();
            photoGalleryList.innerHTML = '';

            if (photos.length === 0) {
                photoGalleryList.innerHTML = '<p>No photos found.</p>';
                return;
            }

            photos.forEach(photoName => {
                const photoCard = document.createElement('div');
                photoCard.style.border = '1px solid #ddd';
                photoCard.style.borderRadius = '8px';
                photoCard.style.overflow = 'hidden';
                photoCard.style.textAlign = 'center';
                photoCard.style.background = '#fff';

                const img = document.createElement('img');
                img.src = `/photos/${photoName}`;
                img.style.width = '100%';
                img.style.height = '150px';
                img.style.objectFit = 'cover';

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.background = '#ff4444';
                deleteBtn.style.color = 'white';
                deleteBtn.style.border = 'none';
                deleteBtn.style.padding = '5px 10px';
                deleteBtn.style.margin = '10px';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.borderRadius = '4px';

                deleteBtn.addEventListener('click', async () => {
                    const result = await Swal.fire({
                        title: 'Are you sure?',
                        text: "You won't be able to revert this!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Yes, delete it!'
                    });

                    if (result.isConfirmed) {
                        try {
                            const response = await fetch('/admin/delete-photo', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: photoName })
                            });
                            if (response.ok) {
                                Swal.fire('Deleted!', 'Your file has been deleted.', 'success');
                                loadPhotoGallery(); // Refresh gallery
                            } else {
                                Swal.fire('Error!', 'Failed to delete photo.', 'error');
                            }
                        } catch (error) {
                            console.error("Error deleting photo:", error);
                            Swal.fire('Error!', 'An error occurred.', 'error');
                        }
                    }
                });

                photoCard.appendChild(img);
                photoCard.appendChild(deleteBtn);
                photoGalleryList.appendChild(photoCard);
            });

        } catch (error) {
            console.error("Error loading photo gallery:", error);
            photoGalleryList.innerHTML = '<p>Error loading photos.</p>';
        }
    };

    // Initial setup
    loadTheme();
    checkPassword();
    loadFrames();
    loadSettings();
    loadEmailConfig();
    loadEmailLogs();
    loadPhotoGallery();
});
