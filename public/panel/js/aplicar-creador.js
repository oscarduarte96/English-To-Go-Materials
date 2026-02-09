/* =========================================
   CREATOR APPLICATION LOGIC
   Handles form submission and email notification.
   ========================================= */

import { auth } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// --- EmailJS Configuration ---
// --- EmailJS Configuration ---
// IMPORTANT: Replace these with your own EmailJS credentials.
// 1. Go to https://www.emailjs.com/ and create an account.
// 2. Create a new Email Service (e.g., Gmail) -> Get Service ID.
// 3. Create a new Email Template -> Get Template ID.
// 4. Go to Account > API Keys -> Get Public Key.
const EMAILJS_PUBLIC_KEY = 'aaXgY6L70Q9AXKM4e';
const EMAILJS_SERVICE_ID = 'service_t56qt3w';
const EMAILJS_TEMPLATE_ID = 'template_lyr4cag';
const ADMIN_EMAIL = 'hola.englishtogo@gmail.com';

// --- DOM Elements ---
const form = document.getElementById('creatorApplicationForm');
const btnSubmit = document.getElementById('btnSubmit');
const statusMessage = document.getElementById('statusMessage');
const motivationTextarea = document.getElementById('motivation');
const charCountSpan = document.getElementById('charCount');

let currentUser = null;

// --- Auth Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    } else {
        // Redirect to login if not authenticated (guard.js should also handle this)
        window.location.href = '../auth/login.html';
    }
});

// --- Character Counter ---
if (motivationTextarea && charCountSpan) {
    motivationTextarea.addEventListener('input', () => {
        charCountSpan.textContent = motivationTextarea.value.length;
    });
}

// --- Form Submission ---
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showStatus('error', 'Debes iniciar sesión para enviar la solicitud.');
            return;
        }

        // 1. Collect form data
        const formData = {
            user_name: currentUser.displayName || 'Usuario',
            user_email: currentUser.email,
            user_uid: currentUser.uid,
            profile_url: document.getElementById('profileUrl').value,
            educational_niche: document.getElementById('educationalNiche').value,
            sample_url: document.getElementById('sampleUrl').value,
            motivation: document.getElementById('motivation').value,
            phone: document.getElementById('phone').value,
            to_email: ADMIN_EMAIL
        };

        // 2. Loading state
        const originalBtnContent = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
        btnSubmit.disabled = true;

        try {
            // 3. Initialize EmailJS
            if (typeof emailjs !== 'undefined') {
                emailjs.init(EMAILJS_PUBLIC_KEY);

                // 4. Send email via EmailJS
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formData);

                // 5. Success!
                showStatus('success', 'Tu solicitud ha sido enviada');
                form.reset();
                charCountSpan.textContent = '0';

            } else {
                console.error('EmailJS SDK not loaded.');
                showStatus('error', 'Error interno: No se pudo cargar el servicio de correo.');
            }

        } catch (error) {
            console.error('Error sending application:', error);
            showStatus('error', 'Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.');
        } finally {
            btnSubmit.innerHTML = originalBtnContent;
            btnSubmit.disabled = false;
        }
    });
}

/**
 * Show status message below the form.
 * @param {'success' | 'error'} type 
 * @param {string} message 
 */
function showStatus(type, message) {
    statusMessage.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'border-green-200', 'border-red-200');

    if (type === 'success') {
        statusMessage.classList.add('bg-green-50', 'text-green-700', 'border', 'border-green-200');
    } else {
        statusMessage.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
    }

    statusMessage.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-2"></i>${message}`;
}
