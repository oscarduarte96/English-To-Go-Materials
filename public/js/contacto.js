/* =========================================
   CONTACT FORM LOGIC
   Handles form submission and email notification.
   ========================================= */

import { auth } from "../assets/js/firebase-app.js"; // Import auth to get current user info if available
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// --- EmailJS Configuration ---
// Using same credentials as 'aplicar-creador.js'
const EMAILJS_PUBLIC_KEY = 'aaXgY6L70Q9AXKM4e';
const EMAILJS_SERVICE_ID = 'service_t56qt3w';
const EMAILJS_TEMPLATE_ID = 'template_lyr4cag';
const ADMIN_EMAIL = 'hola.englishtogo@gmail.com';

// --- DOM Elements ---
const contactForm = document.getElementById('contactForm');
const btnSubmit = document.getElementById('btnSubmit'); // Add ID to button in HTML
const successContainer = document.getElementById('successContainer'); // Add ID to success container in HTML
const formContainer = document.getElementById('formContainer'); // Wrap form in a div with this ID

let currentUser = null;

// --- Auth Check (Optional - pre-fill data) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Optional: Pre-fill fields if empty
        const nameInput = document.getElementById('contactName');
        const emailInput = document.getElementById('contactEmail');
        if (nameInput && !nameInput.value && user.displayName) nameInput.value = user.displayName;
        if (emailInput && !emailInput.value && user.email) emailInput.value = user.email;
    }
});

// --- Form Submission ---
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Collect form data
        const subjectSelect = document.getElementById('contactSubject');
        const subjectText = subjectSelect.options[subjectSelect.selectedIndex].text;

        const formData = {
            // Mapping to existing template variables in 'template_lyr4cag'
            // Expected by template: user_name, user_email, educational_niche (as subject), motivation (as message), etc.
            user_name: document.getElementById('contactName').value,
            user_email: document.getElementById('contactEmail').value,
            educational_niche: `[Soporte: ${subjectText}]`, // Using this field for Subject/Topic
            motivation: document.getElementById('contactMessage').value, // Using this field for Message

            // Fills for other required template fields to avoid errors/blanks
            user_uid: currentUser ? currentUser.uid : 'Guest',
            profile_url: 'N/A (Contact Form)',
            sample_url: 'N/A (Contact Form)',
            phone: 'N/A (Contact Form)',
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
                showSuccessState();

            } else {
                console.error('EmailJS SDK not loaded.');
                alert('Error interno: No se pudo cargar el servicio de correo. Por favor intenta más tarde o escribe directamente a nuestro correo.');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Hubo un error al enviar tu mensaje. Por favor intenta de nuevo.');
        } finally {
            if (btnSubmit) {
                btnSubmit.innerHTML = originalBtnContent;
                btnSubmit.disabled = false;
            }
        }
    });
}

function showSuccessState() {
    // Hide form, show success
    if (formContainer) formContainer.classList.add('hidden');
    if (successContainer) successContainer.classList.remove('hidden');

    // Smooth scroll to top of container
    if (successContainer) successContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
