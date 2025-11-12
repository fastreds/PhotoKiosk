# 📸 Kiosco Fotográfico Temático

¡Bienvenido al Kiosco Fotográfico Temático! Una aplicación web interactiva diseñada para eventos, donde los usuarios pueden tomarse fotos, aplicarles marcos temáticos divertidos y recibir el resultado final por correo electrónico o mediante un código QR.

![Demostración del Kiosco](https-i-imgur-com-w2E2w2E-gif) 

## ✨ Características Principales

- **Toma de Fotos en Vivo**: Interfaz sencilla para capturar fotos directamente desde la cámara del dispositivo.
- **Marcos Temáticos Personalizables**: Permite a los administradores subir y gestionar una variedad de marcos PNG transparentes.
- **Galería Interactiva**: Un carrusel de fotos con aspecto de Polaroid muestra las últimas 100 imágenes tomadas, con efecto de zoom al hacer clic.
- **Envío por Correo Electrónico**: Los usuarios pueden enviar la foto final a su dirección de correo.
- **Descarga con Código QR**: Genera un código QR para descargar la imagen directamente en un dispositivo móvil.
- **Panel de Administración**: Una sección protegida por contraseña para gestionar los marcos (subir, eliminar, activar/desactivar).
- **Tema Oscuro**: Interfaz adaptable con un tema oscuro para el panel de administración.

## 🚀 Instalación y Uso

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 14 o superior)
- npm (generalmente se instala con Node.js)

### Pasos

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/PhotoKiosk.git
    cd PhotoKiosk
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```
    Esto instalará Express, Sharp, Nodemailer, Multer y otras librerías necesarias.

3.  **Configura las credenciales de correo (Opcional):**
    Si deseas que la función de envío de correo funcione, deberás configurar tus credenciales de Gmail en `server.js`. Busca la siguiente sección y reemplaza los valores:
    ```javascript
    let transporter = nodemailer.createTransport("smtps://TU_CORREO%40gmail.com:TU_CONTRASEÑA_DE_APLICACION@smtp.gmail.com:465");
    ```
    > **Nota de Seguridad**: Se recomienda utilizar variables de entorno para manejar credenciales en un entorno de producción.

4.  **Inicia el servidor:**
    ```bash
    npm start
    ```
    El servidor se ejecutará en `http://localhost:3000`.

5.  **Accede a la aplicación:**
    - **Kiosco Principal**: Abre tu navegador y visita `http://localhost:3000`.
    - **Panel de Administración**: Visita `http://localhost:3000/admin.html`. La contraseña por defecto es `admin123`.

## 📂 Estructura del Proyecto

```
/
├── public/
│   ├── frames/         # Almacena los archivos de marcos PNG
│   ├── photos/         # Guarda las fotos finales generadas
│   ├── uploads/        # Directorio temporal para fotos subidas
│   ├── vendor/         # Librerías de terceros (cliente)
│   ├── admin.html      # Interfaz del panel de administración
│   ├── carousel.html   # Página de la galería de fotos
│   ├── index.html      # Página principal del kiosco
│   └── ... (CSS, JS)
├── server.js           # Lógica del servidor (rutas, procesamiento de imágenes)
├── frames.json         # Gestiona el estado de los marcos (nombre, disponibilidad)
├── package.json        # Dependencias y scripts del proyecto
└── README.md           # Este archivo
```

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express.js
- **Procesamiento de Imágenes**: Sharp, Jimp, @imgly/background-removal-node
- **Envío de Correos**: Nodemailer
- **Frontend**: HTML5, CSS3, JavaScript
- **Carrusel**: Swiper.js
- **Alertas y Modales**: SweetAlert2
- **Manejo de Archivos**: Multer

---

Creado con ❤️ para capturar momentos inolvidables.
