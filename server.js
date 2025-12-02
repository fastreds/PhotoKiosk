const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const dotenv = require('dotenv');
const qrcode = require('qrcode');
const { removeBackground } = require('@imgly/background-removal-node');
const Jimp = require('jimp');

// Load environment variables
// Priority: 
// 1. System Environment Variables (Render Dashboard)
// 2. /etc/secrets/.env (Render Secret File)
// 3. .env (Local Development)

const secretEnvPath = '/etc/secrets/.env';
if (fs.existsSync(secretEnvPath)) {
    console.log(`Loading environment variables from ${secretEnvPath}`);
    dotenv.config({ path: secretEnvPath });
} else {
    console.log("Loading environment variables from local .env (if exists)");
    dotenv.config();
}

// Debug logging for credentials (masked)
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
console.log(`Email Config Status: User=${emailUser ? 'SET' : 'MISSING'}, Pass=${emailPass ? 'SET' : 'MISSING'}`);

const app = express();
const FRAME_DIR = path.join(__dirname, 'public/frames');
const PHOTOS_DIR = path.join(__dirname, 'public/photos'); // Directorio de fotos
const FRAMES_JSON_PATH = path.join(__dirname, 'frames.json');

// Asegurarse de que los directorios existan
if (!fs.existsSync(FRAME_DIR)) {
    fs.mkdirSync(FRAME_DIR, { recursive: true });
}
if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Helper function to read/write frames.json
const readFramesData = () => {
    if (!fs.existsSync(FRAMES_JSON_PATH)) {
        return [];
    }
    try {
        const json = fs.readFileSync(FRAMES_JSON_PATH, 'utf-8');
        return JSON.parse(json);
    } catch (e) {
        return []; // Return empty array if JSON is corrupt
    }
};

const writeFramesData = (data) => {
    fs.writeFileSync(FRAMES_JSON_PATH, JSON.stringify(data, null, 2));
};

// Sync frames.json with the actual files in the frames directory
const syncFrames = () => {
    if (!fs.existsSync(FRAME_DIR)) {
        fs.mkdirSync(FRAME_DIR);
    }
    const files = fs.readdirSync(FRAME_DIR);
    let framesData = readFramesData();

    const existingFiles = framesData.map(f => f.name);

    // Add new files to frames.json
    files.forEach(file => {
        if (!existingFiles.includes(file)) {
            framesData.push({ name: file, available: true });
        }
    });

    // Remove files from frames.json that no longer exist
    framesData = framesData.filter(f => files.includes(f.name));

    writeFramesData(framesData);
};

// Initial sync on server start
syncFrames();

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/photos', express.static(path.join(__dirname, 'public/photos'))); // Servir fotos estáticamente
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

const frameStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/frames/');
    },
    filename: function (req, file, cb) {
        // En una aplicación real, deberías sanitizar el nombre del archivo
        cb(null, file.originalname);
    }
});

const frameUpload = multer({ storage: frameStorage });

// --- Resto del código sin cambios ---

app.post('/save-frame', frameUpload.single('frame'), (req, res) => {
    // Con multer.diskStorage, el archivo ya está guardado correctamente.
    // Solo necesitamos enviar una respuesta de éxito y sincronizar.
    syncFrames();
    res.json({ success: true });
});

// Endpoint for Kiosk (only available frames)
app.get('/frames', (req, res) => {
    const framesData = readFramesData();
    const availableFrames = framesData.filter(f => f.available).map(f => f.name);
    res.json(availableFrames);
});

// Endpoint to get the list of photos
app.get('/photos', (req, res) => {
    try {
        const photoFiles = fs.readdirSync(PHOTOS_DIR)
            .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file)) // Filtrar por extensiones de imagen
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(PHOTOS_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time) // Ordenar por fecha de modificación (más recientes primero)
            .slice(0, 100) // Limitar a los últimos 100
            .map(file => file.name); // Devolver solo los nombres

        res.json(photoFiles);
    } catch (error) {
        console.error('Error reading photos directory:', error);
        res.status(500).json({ success: false, message: 'Could not retrieve photos.' });
    }
});

// --- Admin Endpoints ---
app.get('/admin/frames', (req, res) => {
    syncFrames(); // Ensure data is fresh
    const framesData = readFramesData();
    res.json(framesData);
});

app.post('/admin/toggle-frame', (req, res) => {
    const { name } = req.body;
    let framesData = readFramesData();
    const frame = framesData.find(f => f.name === name);
    if (frame) {
        frame.available = !frame.available;
        writeFramesData(framesData);
        res.json({ success: true, available: frame.available });
    } else {
        res.status(404).json({ success: false, message: 'Frame not found' });
    }
});

app.delete('/admin/delete-frame', (req, res) => {
    const { name } = req.body;
    const filePath = path.join(FRAME_DIR, name);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Physical delete
        syncFrames(); // Resync to update JSON file
        res.json({ success: true });
    } else {
        syncFrames(); // Resync even if file not found, to clean up JSON
        res.status(404).json({ success: false, message: 'Frame not found' });
    }
});

app.delete('/admin/delete-photo', (req, res) => {
    const { name } = req.body;
    // Basic sanitization to prevent directory traversal
    const safeName = path.basename(name);
    const filePath = path.join(PHOTOS_DIR, safeName);

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            res.json({ success: true });
        } catch (error) {
            console.error("Error deleting photo:", error);
            res.status(500).json({ success: false, message: 'Failed to delete photo' });
        }
    } else {
        res.status(404).json({ success: false, message: 'Photo not found' });
    }
});

app.post('/admin/clean-grid', async (req, res) => {
    const { name } = req.body;
    const filePath = path.join(FRAME_DIR, name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Frame not found' });
    }

    try {
        const image = await Jimp.read(filePath);
        const checkerboardColor1 = 0xFFFFFFFF; // Blanco (FFFFFF)
        const checkerboardColor2 = 0xC0C0C0FF; // Gris (C0C0C0)

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const currentColor = this.getPixelColor(x, y);
            // Comparamos los colores ignorando el canal alfa para mayor flexibilidad
            if ((currentColor & 0xFFFFFF00) === (checkerboardColor1 & 0xFFFFFF00) ||
                (currentColor & 0xFFFFFF00) === (checkerboardColor2 & 0xFFFFFF00)) {
                this.setPixelColor(0x00000000, x, y); // Poner en transparente
            }
        });

        await image.writeAsync(filePath); // Sobrescribir el archivo original
        res.json({ success: true });

    } catch (error) {
        console.error('Error cleaning grid:', error);
        res.status(500).json({ success: false, message: 'Failed to clean grid' });
    }
});

app.post('/admin/remove-background', async (req, res) => {
    const { name } = req.body;
    const filePath = path.join(FRAME_DIR, name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Frame not found' });
    }

    try {
        const imageBuffer = fs.readFileSync(filePath);
        const blob = new Blob([imageBuffer], { type: 'image/png' }); // La librería funciona mejor con Blobs

        const resultBlob = await removeBackground(blob);

        const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());
        fs.writeFileSync(filePath, resultBuffer); // Sobrescribir el archivo original

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing background:', error);
        res.status(500).json({ success: false, message: 'Failed to remove background' });
    }
});

app.post('/capture', upload.single('photo'), async (req, res) => {
    // --- Debugging Logs ---
    console.log('--- CAPTURE REQUEST ---');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    // --- End Debugging Logs ---

    try {
        const { frame } = req.body;

        // --- Graceful Error Handling ---
        if (!frame) {
            console.error('Error: Frame name is missing in the request body.');
            return res.status(400).json({ success: false, message: 'Frame name not provided.' });
        }
        if (!req.file || !req.file.path) {
            console.error('Error: Photo file is missing in the request.');
            return res.status(400).json({ success: false, message: 'Photo file not provided.' });
        }
        // --- End Graceful Error Handling ---

        const photoPath = req.file.path;
        const framePath = path.join(__dirname, 'public/frames', frame);
        const outputPath = path.join(__dirname, 'public/photos', `photo-${Date.now()}.png`);

        // Check if frame file exists before processing
        if (!fs.existsSync(framePath)) {
            console.error(`Error: Frame file not found at ${framePath}`);
            return res.status(400).json({ success: false, message: `Frame file ${frame} not found.` });
        }

        const photoBuffer = fs.readFileSync(photoPath);
        const frameBuffer = fs.readFileSync(framePath);

        // Get frame metadata to determine output size
        const frameMetadata = await sharp(frameBuffer).metadata();
        const outputWidth = frameMetadata.width;
        const outputHeight = frameMetadata.height;

        // 1. Resize the main photo to COVER the frame dimensions
        const mainPhoto = await sharp(photoBuffer)
            .resize(outputWidth, outputHeight, { fit: 'cover' })
            .toBuffer();

        // 2. Composite: Main photo first, then frame on top
        await sharp(mainPhoto)
            .composite([
                { input: frameBuffer, gravity: 'center' }
            ])
            .toFile(outputPath);

        // Remove temporary uploaded photo
        fs.unlinkSync(photoPath);

        const finalUrl = `${req.protocol}://${req.get('host')}/photos/${path.basename(outputPath)}`;

        res.json({ success: true, url: finalUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error processing image' });
    }
});

// Old send-email endpoint removed/replaced by the new one above
// app.post('/send-email', ... );

app.get('/qr-code', async (req, res) => {
    const { photoUrl } = req.query;
    const qrCode = await qrcode.toDataURL(photoUrl);
    res.send(`<img src="${qrCode}"/>`);
});

// --- Settings Management ---
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const readSettings = () => {
    if (!fs.existsSync(SETTINGS_PATH)) {
        return { countdownDuration: 3, photoInterval: 2 }; // Defaults
    }
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch (e) {
        return { countdownDuration: 3, photoInterval: 2 };
    }
};

const writeSettings = (settings) => {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
};

app.get('/settings', (req, res) => {
    res.json(readSettings());
});

app.post('/admin/settings', (req, res) => {
    const { countdownDuration, photoInterval } = req.body;
    const settings = {
        countdownDuration: parseInt(countdownDuration) || 3,
        photoInterval: parseInt(photoInterval) || 2
    };
    writeSettings(settings);
    res.json({ success: true, settings });
});

// --- Email Management ---
const EMAILS_DB_PATH = path.join(__dirname, 'emails.json');
const EMAIL_CONFIG_PATH = path.join(__dirname, 'emailConfig.json');

const readEmails = () => {
    if (!fs.existsSync(EMAILS_DB_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(EMAILS_DB_PATH, 'utf-8'));
    } catch (e) { return []; }
};

const saveEmailLog = (log) => {
    const logs = readEmails();
    logs.unshift(log); // Add to beginning
    fs.writeFileSync(EMAILS_DB_PATH, JSON.stringify(logs, null, 2));
};

const readEmailConfig = () => {
    if (!fs.existsSync(EMAIL_CONFIG_PATH)) {
        return {
            senderName: "Photo Kiosk",
            subject: "Your Themed Photo!",
            htmlTemplate: "<p>Here is your photo!</p><img src='{{photoUrl}}' alt='photo'/>"
        };
    }
    try {
        return JSON.parse(fs.readFileSync(EMAIL_CONFIG_PATH, 'utf-8'));
    } catch (e) {
        return {
            senderName: "Photo Kiosk",
            subject: "Your Themed Photo!",
            htmlTemplate: "<p>Here is your photo!</p><img src='{{photoUrl}}' alt='photo'/>"
        };
    }
};

const saveEmailConfig = (config) => {
    fs.writeFileSync(EMAIL_CONFIG_PATH, JSON.stringify(config, null, 2));
};

app.post('/send-email', async (req, res) => {
    const { email, photoUrl } = req.body;
    const config = readEmailConfig();

    console.log(`Attempting to send email to ${email} with photo ${photoUrl}`);

    try {
        // Use object syntax for better control
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            connectionTimeout: 10000, // 10 seconds timeout
        });

        // Convert URL to local path if possible to avoid self-request deadlock or network issues
        let attachmentPath = photoUrl;
        if (photoUrl.startsWith('http')) {
            try {
                const urlObj = new URL(photoUrl);
                // Assuming the URL path maps to 'public' folder
                // e.g. /photos/filename.png -> public/photos/filename.png
                const relativePath = urlObj.pathname; // /photos/filename.png
                // Remove leading slash
                const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
                const localPath = path.join(__dirname, 'public', cleanPath);

                if (fs.existsSync(localPath)) {
                    attachmentPath = localPath;
                    console.log(`Using local file path: ${attachmentPath}`);
                } else {
                    console.warn(`Local file not found at ${localPath}, falling back to URL.`);
                }
            } catch (e) {
                console.warn("Error parsing URL, using original:", e);
            }
        }

        const htmlContent = config.htmlTemplate.replace('{{photoUrl}}', photoUrl); // Keep URL for HTML src

        let info = await transporter.sendMail({
            from: `"${config.senderName}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: config.subject,
            html: htmlContent,
            attachments: [
                {
                    filename: 'photo.png',
                    path: attachmentPath
                }
            ]
        });

        console.log("Message sent: %s", info.messageId);

        // Save log
        saveEmailLog({
            id: Date.now(),
            date: new Date().toISOString(),
            email,
            photoUrl,
            status: 'sent',
            messageId: info.messageId
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error sending email:", error);
        saveEmailLog({
            id: Date.now(),
            date: new Date().toISOString(),
            email,
            photoUrl,
            status: 'failed',
            error: error.message
        });
        res.status(500).json({ success: false, message: 'Failed to send email: ' + error.message });
    }
});

app.get('/admin/emails', (req, res) => {
    res.json(readEmails());
});

app.get('/admin/email-config', (req, res) => {
    res.json(readEmailConfig());
});

app.post('/admin/email-config', (req, res) => {
    saveEmailConfig(req.body);
    res.json({ success: true });
});

app.post('/admin/resend-email', async (req, res) => {
    const { email, photoUrl } = req.body;
    // Reuse the logic by calling the internal function or just redirecting the request locally?
    // For simplicity, I'll copy the logic or call the handler if refactored.
    // Let's just do a fetch to our own endpoint or duplicate logic. Duplicating logic is safer here to avoid recursion issues.

    const config = readEmailConfig();
    try {
        let transporter = nodemailer.createTransport(`smtps://${encodeURIComponent(process.env.EMAIL_USER)}:${process.env.EMAIL_PASS}@smtp.gmail.com:465`);
        const htmlContent = config.htmlTemplate.replace('{{photoUrl}}', photoUrl);

        await transporter.sendMail({
            from: `"${config.senderName}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: config.subject,
            html: htmlContent,
            attachments: [{ filename: 'photo.png', path: photoUrl }]
        });

        saveEmailLog({
            id: Date.now(),
            date: new Date().toISOString(),
            email,
            photoUrl,
            status: 'resent',
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error resending email:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
