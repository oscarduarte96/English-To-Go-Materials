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

// 3. Lógica del Botón "Activar Modo Creador"
if (ui.btnActivate) {
    ui.btnActivate.addEventListener('click', async () => {
        if (!currentUser) return;

        // Paso 1: Confirmación
        const confirmacion = confirm("¿Quieres convertir tu cuenta en perfil de Creador para vender material?");
        if (!confirmacion) return;

        // Paso 2: Datos de la Tienda
        const storeName = prompt("Ingresa un nombre público para tu Tienda/Perfil:");
        if (!storeName || storeName.trim() === "") {
            alert("El nombre de la tienda es obligatorio.");
            return;
        }

        // Paso 3: Feedback Visual (Loading)
        const originalText = ui.btnActivate.innerHTML;
        ui.btnActivate.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
        ui.btnActivate.disabled = true;

        try {
            // Paso 4: Actualización en Firestore
            const userRef = doc(db, "users", currentUser.uid);
            
            await updateDoc(userRef, {
                "roles.teacher": true,
                "sellerProfile": {
                    storeName: storeName.trim(),
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    totalSales: 0,
                    rating: 0
                }
            });

            // Paso 5: Éxito
            alert(`¡Felicidades! Tu tienda "${storeName}" ha sido creada.`);
            window.location.reload(); // Recargar para actualizar la UI completa (Header y Dashboard)

        } catch (error) {
            console.error("Error activando modo creador:", error);
            alert("Hubo un error al actualizar tu perfil. Por favor intenta de nuevo.");
            
            // Restaurar botón
            ui.btnActivate.innerHTML = originalText;
            ui.btnActivate.disabled = false;
        }
    });
}