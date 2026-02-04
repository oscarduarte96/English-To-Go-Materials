/**
 * ============================================================================
 * UTILIDADES GLOBALES (UTILS.JS)
 * ============================================================================
 * Responsabilidad: 
 * 1. Centralizar funciones de formateo (Moneda, Fechas).
 * 2. Optimización de rendimiento (Debounce).
 * 3. Manejo de rutas y navegación.
 * 4. Expuesto globalmente como 'window.utils' para acceso universal.
 */

const Utils = {

    // ------------------------------------------------------------------------
    // 1. FORMATEO
    // ------------------------------------------------------------------------

    /**
     * Formatea un número a Pesos Colombianos (COP) sin decimales y con sufijo explícito.
     * @param {number|string} amount - El monto a formatear.
     * @returns {string} - Ej: "$ 50.000 COP"
     */
    formatCurrency: (amount) => {
        // Validación de seguridad
        if (amount === undefined || amount === null || isNaN(amount)) {
            return '$ 0 COP';
        }

        // Formateo base (genera "$ 50.000")
        const formatted = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);

        // Concatenación explícita de la divisa
        return `${formatted} COP`;
    },

    /**
     * Formatea fechas (soporta Timestamp de Firebase, Date object o string).
     * @param {Object|string} dateInput - Timestamp de Firebase o fecha estándar.
     * @returns {string} - Ej: "22/01/2026"
     */
    formatDate: (dateInput) => {
        if (!dateInput) return 'Fecha desconocida';

        let date;

        // Caso A: Es un Timestamp de Firebase (tiene método toDate)
        if (dateInput && typeof dateInput.toDate === 'function') {
            date = dateInput.toDate();
        }
        // Caso B: Es un string o número
        else {
            date = new Date(dateInput);
        }

        // Validar si la fecha es válida
        if (isNaN(date.getTime())) return 'Fecha inválida';

        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    },

    /**
     * Trunca un texto si excede cierta longitud.
     * @param {string} str - Texto original.
     * @param {number} length - Longitud máxima.
     */
    truncateString: (str, length = 100) => {
        if (!str) return '';
        if (str.length <= length) return str;
        return str.slice(0, length) + '...';
    },

    // ------------------------------------------------------------------------
    // 2. OPTIMIZACIÓN (Performance)
    // ------------------------------------------------------------------------

    /**
     * DEBOUNCE: Retrasa la ejecución de una función hasta que el usuario 
     * deje de realizar la acción (vital para buscadores).
     * * @param {Function} func - La función a ejecutar (ej: búsqueda en DB).
     * @param {number} wait - Tiempo de espera en ms (ej: 500ms).
     */
    debounce: (func, wait = 300) => {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    },

    // ------------------------------------------------------------------------
    // 3. RUTAS Y NAVEGACIÓN
    // ------------------------------------------------------------------------

    /**
     * Obtiene el parámetro de la URL (Query String).
     * Útil para: producto.html?id=123 -> getURLParam('id') devuelve '123'
     */
    getURLParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Calcula la ruta base relativa dependiendo de dónde estemos.
     * Útil para cargar imágenes o links dinámicamente.
     * Retorna '../' si estamos en /public/ o /panel/, './' si estamos en root.
     */
    getBasePath: () => {
        const path = window.location.pathname;
        // Si estamos en una subcarpeta conocida
        if (path.includes('/panel/') ||
            path.includes('/auth/')) {
            return '../';
        }
        return './';
    },

    // ------------------------------------------------------------------------
    // 4. INTERACCIONES (Share, Copy, Feedback)
    // ------------------------------------------------------------------------

    /**
     * Comparte contenido usando la API nativa o copiando al portapapeles.
     * @param {Object} data - { title, text, url }
     */
    shareContent: async ({ title, text, url }) => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: title || 'English To Go',
                    text: text || '',
                    url: url || window.location.href
                });
                return true;
            } else {
                await navigator.clipboard.writeText(url);
                Utils.showToast("¡Enlace copiado al portapapeles!");
                return true;
            }
        } catch (err) {
            console.error("Error al compartir:", err);
            return false;
        }
    },

    /**
     * Muestra una notificación temporal tipo Toast.
     * @param {string} message 
     */
    showToast: (message) => {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg z-[9999] text-sm font-bold flex items-center gap-2 animate-fade-in-up";
        toast.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// ============================================================================
// EXPORTACIÓN
// ============================================================================

// 1. Exponer en WINDOW para acceso global (Legacy & HTML Inline support)
window.utils = Utils;

// 2. Exponer como Módulo ES (Para imports modernos: import utils from ...)
export default Utils;

// 3. Exportar funciones individuales si se prefiere destructuring
export const { formatCurrency, formatDate, debounce, getBasePath, getURLParam, shareContent, showToast } = Utils;

console.log("✅ Utils cargado correctamente");