/**
 * OrderService.js
 * Servicio para abstraer y estandarizar la logica de checkout y descargas gratuitas
 */
import { db, auth } from "../../assets/js/firebase-app.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const OrderService = {

    /**
     * Procesa la descarga gratuita de un producto
     * @param {Object} product - Objeto del producto
     * @param {HTMLElement} btnElement - Botón que desencadenó la acción para feedback
     * @param {String} sourcePlatform - Origen de la acción (ej: 'web_catalog_direct')
     */
    async handleFreeDownload(product, btnElement, sourcePlatform) {
        const user = auth.currentUser;

        if (!user) {
            alert("Para descargar materiales gratuitos, por favor inicia sesión o regístrate.");

            // Smart Redirect: Save Intent
            const intent = {
                type: 'open_product',
                productId: product.id,
                returnUrl: window.location.href
            };
            sessionStorage.setItem('pending_intent', JSON.stringify(intent));

            window.location.href = '../auth/login.html?mode=register';
            return;
        }

        // UI Loading
        const originalText = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';

        try {
            // Crear orden "completed" directamente para items gratuitos
            const orderData = {
                user_id: user.uid,
                user_email: user.email,
                user_name: user.displayName || "Usuario",
                items: [{
                    id: product.id,
                    titulo: product.titulo,
                    precio: 0,
                    imagen: product._img || product.imagenes_preview?.[0] || null,
                    tipo: product.tipo_archivo || 'Digital',
                    // En catalogo y cart es creador_uid, en profile/cart.js podria ser distinto, validamos:
                    autor_id: product.creador_uid || product.autor_id || 'unknown',
                    url_archivo: product.url_archivo || null,
                    url_acceso: product.url_acceso || null,
                    tipo_archivo: product.tipo_archivo || 'Digital',
                    tipo_entrega: product.tipo_entrega || 'local_download'
                }],
                original_total: 0,
                discount_amount: 0,
                final_total: 0,
                currency: 'COP',
                status: 'pending', // TODO: Idealmente Cloud Function hace pending -> completed
                payment_method: 'free_download',
                created_at: serverTimestamp(),
                platform: sourcePlatform || 'web'
            };

            const docRef = await addDoc(collection(db, "orders"), orderData);
            console.log("Descarga registrada con ID:", docRef.id);

            // Éxito visual
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> ¡Listo!';

            // Fix para el color según la pagina de origen
            if (btnElement.classList.contains('bg-emerald-600')) {
                btnElement.classList.replace('bg-emerald-600', 'bg-slate-800');
            }

            setTimeout(() => {
                alert("¡Orden gratuita procesada!\n(El material aparecerá en la biblioteca si las reglas permiten pending a completed automatizado, o al ajustar Cloud Functions)");
                window.location.href = '../panel/biblioteca.html';
            }, 800);

        } catch (error) {
            console.error("Error procesando descarga:", error);

            // Error handling specific to security rules blocking 'completed' direct status
            if (error.code === 'permission-denied') {
                alert("Operación denegada. Verifica la configuración de reglas de base de datos.");
            } else {
                alert("Hubo un error al procesar la descarga. Intenta nuevamente.");
            }

            btnElement.disabled = false;
            btnElement.innerHTML = originalText;
        }
    }
};

export default OrderService;
