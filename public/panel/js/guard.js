/* =========================================
   SECURITY GUARD - MATERIALS TO GO
   Verifica sesión antes de mostrar contenido privado.
   Permite acceso público a perfiles si hay ?uid= en la URL.
   ========================================= */

// 1. Check if this is a public profile view (uid param in URL)
const urlParams = new URLSearchParams(window.location.search);
const viewingPublicProfile = urlParams.has('uid');

// 2. Only hide content if NOT viewing a public profile
if (!viewingPublicProfile) {
    document.body.style.visibility = "hidden";
}

// 3. Importamos la función de escucha de Firebase Auth (v12.7.0)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// 4. Importamos la instancia de autenticación configurada desde tu 'firebase-app.js'
import { auth } from "../../assets/js/firebase-app.js";

// 5. Observador de Estado (El "Portero")
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ✅ USUARIO AUTENTICADO
        console.log("%c🔓 ACCESO AUTORIZADO", "color:green; font-weight:bold;", user.email);

        // Restaurar visibilidad del contenido
        document.body.style.visibility = "visible";
        document.body.style.opacity = "1";

    } else if (viewingPublicProfile) {
        // 👁️ VISITANTE VIENDO PERFIL PÚBLICO (permitido)
        console.log("%c👁️ VISTA PÚBLICA", "color:blue; font-weight:bold;", "Viewing public profile");
        document.body.style.visibility = "visible";
        document.body.style.opacity = "1";

    } else {
        // ⛔ USUARIO NO AUTENTICADO intentando acceder a página privada
        console.warn("⛔ Acceso denegado. Redirigiendo al login...");

        sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
        window.location.replace("/auth/login.html");
    }
});