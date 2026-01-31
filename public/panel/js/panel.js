/* =========================================
   PANEL LOGIC - DASHBOARD CONTROL
   Gestiona la vista principal, roles y activación de vendedor.
   ========================================= */

import { auth, db } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// 1. Referencias al DOM (Cacheamos los elementos)
const ui = {
    userName: document.getElementById('user-name'),
    teacherSection: document.getElementById('teacher-section'),
    teacherBanner: document.getElementById('become-teacher-banner'),
    btnActivate: document.getElementById('btn-activate-teacher')
};

let currentUser = null;

// 2. Inicialización y Carga de Datos
// Nota: guard.js ya protege la ruta, aquí solo pintamos la info.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        // A. Saludo Personalizado
        const firstName = (user.displayName || "Estudiante").split(' ')[0];
        if (ui.userName) ui.userName.innerText = firstName;

        // B. Verificación de Rol (Estudiante vs Profesor)
        await checkUserRole(user.uid);
    }
});

/**
 * Consulta en Firestore si el usuario tiene el rol de profesor
 * y ajusta la interfaz (Muestra/Oculta secciones).
 */
async function checkUserRole(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const isTeacher = data.roles && data.roles.teacher === true;

            if (isTeacher) {
                // --> ES PROFESOR: Ver panel de ventas
                ui.teacherSection.classList.remove('hidden');
                ui.teacherBanner.classList.add('hidden');
            } else {
                // --> ES ESTUDIANTE: Ver banner de promoción
                ui.teacherSection.classList.add('hidden');
                ui.teacherBanner.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Error cargando perfil del usuario:", error);
    }
}

// Note: The 'Activate Creator Mode' button has been replaced with a link to the application page.
// No direct role activation logic is handled here anymore.