const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const qrcode = require('qrcode');

// Load environment variables
const secretEnvPath = '/etc/secrets/.env';
if (fs.existsSync(secretEnvPath)) {
    console.log(`Loading environment variables from ${secretEnvPath}`);
    dotenv.config({ path: secretEnvPath });
} else {
    console.log("Loading environment variables from local .env (if exists)");
    dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/send-email', async (req, res) => {
    const { email, photoUrl, config } = req.body;

    console.log(`Attempting to send email to ${email}`);

    try {
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: "fastreds@gmail.com",
                pass: "zjahytqliioomcqp",
            },
            connectionTimeout: 10000,
        });

        // Use provided config or defaults
        const senderName = config?.senderName || "Photo Kiosk";
        const subject = config?.subject || "Your Themed Photo!";
        const htmlTemplate = config?.htmlTemplate || "<p>Here is your photo!</p><img src='{{photoUrl}}' alt='photo'/>";

        const htmlContent = htmlTemplate.replace('{{photoUrl}}', photoUrl);

        let info = await transporter.sendMail({
            from: `"${senderName}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            html: htmlContent,
            attachments: [
                {
                    filename: 'photo.png',
                    path: photoUrl // Nodemailer handles URLs automatically
                }
            ]
        });

        console.log("Message sent: %s", info.messageId);
        res.json({ success: true });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: 'Failed to send email: ' + error.message });
    }
});

app.get('/qr-code', async (req, res) => {
    const { photoUrl } = req.query;
    try {
        const qrCode = await qrcode.toDataURL(photoUrl);
        res.send(`<img src="${qrCode}"/>`);
    } catch (e) {
        res.status(500).send('Error generating QR code');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
