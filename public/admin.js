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

    // Initial setup
    loadTheme();
    checkPassword();
    loadFrames();
});
