// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkuqtFVL-UuN7X_Lw3E_awOeDY1EGWgEU",
  authDomain: "photokiosk-fe85a.firebaseapp.com",
  projectId: "photokiosk-fe85a",
  storageBucket: "photokiosk-fe85a.firebasestorage.app",
  messagingSenderId: "716148722960",
  appId: "1:716148722960:web:c1ac75c50c5d9d6f7ee995"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
