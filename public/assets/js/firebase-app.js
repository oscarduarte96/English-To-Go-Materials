/* =========================================
   ENGLISH TO GO MATERIALS - FIREBASE CORE
   Configuración centralizada y exportación de servicios.
   ========================================= */

// 1. Importamos las funciones necesarias desde el CDN oficial (v12.7.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// 2. Tu Credencial de Proyecto (Materials-To-Go)
// Nota: Estos datos son públicos en el cliente, la seguridad real se maneja con Reglas de Seguridad en Firebase Console.
const firebaseConfig = {
    apiKey: "AIzaSyAurY51BDp73Gmz2d9W4tyf0VR3XwurUZI",
    authDomain: "materials-to-go.firebaseapp.com",
    projectId: "materials-to-go",
    storageBucket: "materials-to-go.firebasestorage.app",
    messagingSenderId: "245926470036",
    appId: "1:245926470036:web:4b1a0a711dbbefd5726f81"
};

// 3. Inicializar la App (Singleton)
// Esto crea la instancia principal que conecta tu HTML con la nube de Google.
const app = initializeApp(firebaseConfig);

// 4. Inicializar Servicios Específicos
const auth = getAuth(app);       // Autenticación (Login/Registro)
const db = getFirestore(app);    // Base de Datos (Usuarios, Ventas)
const storage = getStorage(app); // Almacenamiento (Archivos PDF, IMG)

// 5. Diagnóstico en Consola (Solo para desarrollo)
// Te ayudará a confirmar visualmente que el "cerebro" cargó correctamente.
console.log(
    "%c🔥 FIREBASE CONNECTED%c\n%s",
    "background:#4f46e5; color:white; padding:4px 8px; border-radius:4px; font-weight:bold;",
    "color:#64748b;",
    `Project: ${firebaseConfig.projectId} | Services: Auth, DB, Storage`
);

// 6. Exportación Modular
// Esto permite que otros archivos digan: "import { auth } from './firebase-app.js'"
export { app, auth, db, storage };