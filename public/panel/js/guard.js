/* =========================================
   SECURITY GUARD - MATERIALS TO GO
   Verifica sesión antes de mostrar contenido privado.
   ========================================= */

// 1. Ocultar contenido INMEDIATAMENTE para evitar "flashes" de información
// Esto cumple con tu requerimiento de no mostrar la página hasta confirmar identidad.
document.body.style.visibility = "hidden";

// 2. Importamos la función de escucha de Firebase Auth (v12.7.0)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// 3. Importamos la instancia de autenticación configurada desde tu 'firebase-app.js'
// Nota: La ruta sube 2 niveles (../../) para salir de 'panel/js/' y entrar a 'assets/js/'
import { auth } from "../../assets/js/firebase-app.js";

// 4. Observador de Estado (El "Portero")
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ✅ USUARIO AUTENTICADO
        console.log("%c🔓 ACCESO AUTORIZADO", "color:green; font-weight:bold;", user.email);
        
        // Restaurar visibilidad del contenido
        document.body.style.visibility = "visible";
        document.body.style.opacity = "1"; // Por si usas transiciones CSS
        
    } else {
        // ⛔ USUARIO NO AUTENTICADO
        console.warn("⛔ Acceso denegado. Redirigiendo al login...");
        
        // Guardamos la URL a la que intentaba ir para redirigirlo allí después de loguearse (Opcional pero recomendado UX)
        sessionStorage.setItem("redirectAfterLogin", window.location.pathname);

        // Redirección absoluta a tu página de login
        window.location.replace("/auth/login.html");
    }
});