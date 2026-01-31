/**
 * Upload Logic - Material Publishing Module
 * Handles multi-select filters, file uploads, and intelligent keyword generation
 */

import { db, storage, auth } from '../../assets/js/firebase-app.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

// ==========================================
// CATEGORÍAS MASTER (Sistema de Filtrado)
// ==========================================
const CATEGORIAS = {
    levels: [
        "Pre-A1 (Starters / Pre-school)",
        "A1 (Beginner)",
        "A1-A2 (High Beginner)",
        "A2 (Elementary)",
        "B1 (Intermediate)",
        "B1+ (Intermediate Plus)",
        "B2 (Upper Intermediate)",
        "C1 (Advanced)",
        "C2 (Proficiency)",
        "Multi-level (Adaptable)",
        "Adult Education",
        "Homeschooling"
    ],
    skills: [
        "Speaking (Conversación)",
        "Listening (Escucha)",
        "Reading Comprehension",
        "Writing (Escritura)",
        "Grammar (Gramática)",
        "Vocabulary (Vocabulario)",
        "Pronunciation / Phonetics",
        "Spelling (Ortografía)",
        "Phonics",
        "Critical Thinking",
        "Translation"
    ],
    types: [
        "Worksheet (Hoja de trabajo)",
        "Flashcards (Tarjetas)",
        "Game / Board Game",
        "PowerPoint / Slides",
        "Lesson Plan (Plan de Clase)",
        "Exam / Quiz / Assessment",
        "Project Based Learning",
        "Interactive Notebook",
        "Video Guide",
        "Song / Music Activity",
        "Role Play Script",
        "Ice Breakers",
        "Poster / Decoration",
        "Infographic",
        "Cut-outs / Craft",
        "Web App / URL Privada"
    ],
    exams: [
        "TOEFL iBT",
        "TOEFL ITP",
        "TOEFL Primary/Junior",
        "IELTS Academic",
        "IELTS General Training",
        "Cambridge: A2 Key (KET)",
        "Cambridge: B1 Preliminary (PET)",
        "Cambridge: B2 First (FCE)",
        "Cambridge: C1 Advanced (CAE)",
        "Cambridge: C2 Proficiency (CPE)",
        "TOEIC (Listening & Reading)",
        "TOEIC (Speaking & Writing)",
        "MET (Michigan)",
        "Duolingo English Test",
        "Trinity (GESE/ISE)",
        "APTIS",
        "PTE Academic"
    ],
    tenses: [
        "Present Simple",
        "Present Continuous",
        "Present Perfect",
        "Present Perfect Continuous",
        "Past Simple",
        "Past Continuous",
        "Past Perfect",
        "Past Perfect Continuous",
        "Future Simple (Will)",
        "Future (Going to)",
        "Future Continuous",
        "Future Perfect",
        "Imperative",
        "Conditionals (0, 1, 2, 3)",
        "Mixed Conditionals",
        "Subjunctive",
        "Passive Voice",
        "Reported Speech",
        "Used to / Would"
    ],
    grammar: [
        "Nouns",
        "Pronouns",
        "Adjectives",
        "Adverbs",
        "Prepositions",
        "Articles",
        "Comparatives & Superlatives",
        "Modals",
        "Gerunds & Infinitives",
        "Phrasal Verbs",
        "Question Tags",
        "Relative Clauses",
        "Conjunctions",
        "Quantifiers",
        "Word Order",
        "Prefixes & Suffixes",
        "Collocations",
        "Idioms"
    ],
    context: [
        "Business English",
        "Travel & Tourism",
        "Medical English",
        "Legal English",
        "Aviation English",
        "Daily Routine",
        "Family & Friends",
        "Food & Cooking",
        "Shopping",
        "Clothes & Fashion",
        "Animals & Nature",
        "Sports & Hobbies",
        "Technology & Social Media",
        "Environment",
        "School & Education",
        "Jobs & Professions",
        "Weather & Seasons",
        "Halloween",
        "Christmas",
        "Thanksgiving",
        "Easter",
        "Valentine's Day",
        "Summer Holidays",
        "Movies & TV",
        "Music & Arts"
    ]
};

// ==========================================
// ESTADO DE SELECCIONES
// ==========================================
const selecciones = {
    levels: [],
    skills: [],
    types: [],
    exams: [],
    tenses: [],
    grammar: [],
    context: []
};

// ==========================================
// UTILIDADES VISUALES
// ==========================================

// Contador de caracteres en descripción
const descInput = document.getElementById('description');
const charCount = document.getElementById('charCount');

if (descInput && charCount) {
    descInput.addEventListener('input', () => {
        charCount.textContent = descInput.value.length;
    });
}

// Preview de imágenes
const previewInput = document.getElementById('previewFiles');
const previewContainer = document.getElementById('previewContainer');
const previewCount = document.getElementById('previewCount');

if (previewInput && previewContainer && previewCount) {
    previewInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);

        if (files.length > 5) {
            alert("⚠️ Máximo 5 imágenes permitidas.");
            previewInput.value = "";
            previewContainer.innerHTML = "";
            previewCount.innerText = "Sin selección";
            return;
        }

        previewContainer.innerHTML = "";
        previewCount.innerText = files.length === 0
            ? "Sin selección"
            : `${files.length} imagen${files.length > 1 ? 'es' : ''} seleccionada${files.length > 1 ? 's' : ''}`;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-thumb';
                img.alt = file.name;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// Nombre del archivo principal
const productFileInput = document.getElementById('productFile');
const productFileName = document.getElementById('productFileName');

if (productFileInput && productFileName) {
    productFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            productFileName.innerHTML = `<span class="text-green-600">✅ ${e.target.files[0].name}</span>`;
        } else {
            productFileName.innerHTML = '<span class="text-slate-400 font-normal">Ningún archivo seleccionado</span>';
        }
    });
}

// ==========================================
// TOGGLE: GRATIS VS PAGO
// ==========================================
const isFreeCheckbox = document.getElementById('isFree');
const priceInput = document.getElementById('price');

if (isFreeCheckbox && priceInput) {
    isFreeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Modo Gratis
            priceInput.value = 0;
            priceInput.disabled = true;
            priceInput.classList.add('bg-slate-100', 'text-slate-400');
            priceInput.classList.remove('bg-white', 'text-slate-900');
        } else {
            // Modo Pago
            priceInput.value = '';
            priceInput.disabled = false;
            priceInput.classList.remove('bg-slate-100', 'text-slate-400');
            priceInput.classList.add('bg-white', 'text-slate-900');
            priceInput.focus();
        }
    });
}

// ==========================================
// TOGGLE: TIPO DE ENTREGA (Archivo vs URL)
// ==========================================

const deliveryFileRadio = document.getElementById('deliveryFile');
const deliveryUrlRadio = document.getElementById('deliveryUrl');
const fileContainer = document.getElementById('fileDeliveryContainer');
const urlContainer = document.getElementById('urlDeliveryContainer');

/**
 * Maneja el cambio entre modo Archivo y URL
 */
function toggleDeliveryMode() {
    if (deliveryUrlRadio && deliveryUrlRadio.checked) {
        // Modo URL: Ocultar archivo, mostrar URL
        if (fileContainer) fileContainer.classList.add('hidden');
        if (urlContainer) urlContainer.classList.remove('hidden');
    } else {
        // Modo Archivo: Mostrar archivo, ocultar URL
        if (fileContainer) fileContainer.classList.remove('hidden');
        if (urlContainer) urlContainer.classList.add('hidden');
    }
}

// Event listeners para los radio buttons
if (deliveryFileRadio) {
    deliveryFileRadio.addEventListener('change', toggleDeliveryMode);
}
if (deliveryUrlRadio) {
    deliveryUrlRadio.addEventListener('change', toggleDeliveryMode);
}

// ==========================================
// SISTEMA DE FILTROS MÚLTIPLES (Multi-Select)
// ==========================================

/**
 * Configura un selector múltiple con autocompletado
 * @param {string} key - Clave de la categoría (levels, skills, etc.)
 */
function setupMultiSelect(key) {
    const container = document.getElementById(`filter-${key}`);
    if (!container) return;

    const input = container.querySelector('.search-input');
    const list = container.querySelector('.suggestions-list');
    const tagsContainer = container.querySelector('.selected-tags');
    const options = CATEGORIAS[key];

    /**
     * Renderiza los tags seleccionados
     */
    function renderTags() {
        tagsContainer.innerHTML = '';
        selecciones[key].forEach(item => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `${item} <span class="tag-remove" data-item="${item}">×</span>`;
            tagsContainer.appendChild(tag);
        });

        // Event listeners para eliminar tags
        tagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemToRemove = e.target.getAttribute('data-item');
                selecciones[key] = selecciones[key].filter(i => i !== itemToRemove);
                renderTags();
            });
        });
    }

    /**
     * Filtra y muestra opciones según el término de búsqueda
     * @param {string} term - Término de búsqueda
     */
    function filterAndShow(term) {
        const val = term.toLowerCase();
        const filtered = options.filter(opt =>
            opt.toLowerCase().includes(val) && !selecciones[key].includes(opt)
        );

        list.innerHTML = '';

        if (filtered.length > 0) {
            list.style.display = 'block';
            filtered.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = opt;
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selecciones[key].push(opt);
                    input.value = '';
                    renderTags();
                    input.focus();
                    list.style.display = 'none';
                });
                list.appendChild(div);
            });
        } else {
            list.style.display = 'none';
        }
    }

    // Toggle dropdown al hacer click en el input
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        if (list.style.display === 'block') {
            list.style.display = 'none';
        } else {
            // Cerrar otros dropdowns
            document.querySelectorAll('.suggestions-list').forEach(l => l.style.display = 'none');
            filterAndShow("");
        }
    });

    // Filtrar mientras se escribe
    input.addEventListener('input', (e) => {
        filterAndShow(e.target.value);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            list.style.display = 'none';
        }
    });
}

// Inicializar todos los filtros
Object.keys(CATEGORIAS).forEach(key => setupMultiSelect(key));

// ==========================================
// MOTOR DE BÚSQUEDA - GENERACIÓN DE KEYWORDS
// ==========================================

/**
 * Genera un array de keywords optimizado para búsqueda
 * Extrae palabras del título, descripción y todos los tags seleccionados
 * Normaliza el texto (minúsculas, sin tildes) y elimina duplicados
 * 
 * @param {string} title - Título del material
 * @param {string} description - Descripción del material
 * @param {Object} selections - Objeto con todas las selecciones de filtros
 * @returns {Array<string>} Array de keywords únicas y normalizadas
 */
function generateKeywords(title, description, selections) {
    // 1. Combinar todo el texto relevante
    const allText = [
        title,
        description,
        ...selections.levels,
        ...selections.skills,
        ...selections.types,
        ...selections.exams,
        ...selections.tenses,
        ...selections.grammar,
        ...selections.context
    ].join(" ");

    // 2. Normalizar y limpiar:
    //    - toLowerCase(): convertir a minúsculas
    //    - normalize("NFD"): descomponer caracteres con tildes
    //    - replace(/[\u0300-\u036f]/g, ""): eliminar los diacríticos (tildes)
    //    Ejemplo: "Gramática Básica" -> "gramatica basica"
    const cleanedText = allText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // 3. Dividir en palabras (split por espacios y caracteres especiales)
    const words = cleanedText
        .split(/[\s,;.\-()[\]{}'"!?]+/)
        .filter(w => w.length > 0);

    // 4. Eliminar duplicados usando Set y convertir de vuelta a array
    const uniqueKeywords = [...new Set(words)];

    return uniqueKeywords;
}

// ==========================================
// SUBMIT - PUBLICACIÓN DE MATERIAL
// ==========================================

const form = document.getElementById('uploadForm');
const status = document.getElementById('status');
const btnSubmit = document.getElementById('btnSubmit');

if (form && status && btnSubmit) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Obtener valores del formulario
        const title = document.getElementById('title').value.trim();
        const price = document.getElementById('price').value;
        const description = document.getElementById('description').value.trim();
        const previewFiles = document.getElementById('previewFiles').files;

        // Determinar tipo de entrega
        const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value || 'file';

        // Obtener archivo o URL según el tipo
        const productFile = document.getElementById('productFile').files[0];
        const accessUrl = document.getElementById('accessUrl')?.value.trim();

        // ==========================================
        // VALIDACIONES
        // ==========================================

        const isFree = document.getElementById('isFree')?.checked || false;

        // ==========================================
        // VALIDACIONES
        // ==========================================

        if (!title) {
            return alert("⚠️ El título es obligatorio.");
        }

        // Validación de Precio (Solo si NO es gratis)
        if (!isFree && (!price || Number(price) <= 0)) {
            return alert("⚠️ Ingresa un precio válido mayor a 0.");
        }

        if (selecciones.levels.length === 0) {
            return alert("⚠️ Debes seleccionar al menos un NIVEL (CEFR).");
        }

        if (selecciones.skills.length === 0) {
            return alert("⚠️ Debes seleccionar al menos una HABILIDAD.");
        }

        if (selecciones.types.length === 0) {
            return alert("⚠️ Debes seleccionar al menos un TIPO DE RECURSO.");
        }

        if (previewFiles.length === 0) {
            return alert("⚠️ Debes subir al menos 1 imagen de portada.");
        }

        // Validación según el tipo de entrega
        if (deliveryType === 'file') {
            if (!productFile) {
                return alert("⚠️ Falta el archivo principal para vender.");
            }
        } else if (deliveryType === 'url') {
            if (!accessUrl) {
                return alert("⚠️ Debes ingresar la URL de acceso.");
            }
            // Validar formato de URL
            try {
                const urlObj = new URL(accessUrl);
                if (!urlObj.protocol.startsWith('http')) {
                    throw new Error('Protocolo inválido');
                }
            } catch (error) {
                return alert("⚠️ La URL debe ser válida y comenzar con https:// o http://\nEjemplo: https://mi-app.vercel.app");
            }
        }

        try {
            // Deshabilitar botón y mostrar feedback
            status.innerHTML = `<span class="text-indigo-600 font-bold animate-pulse">⏳ ${deliveryType === 'file' ? 'Subiendo archivos' : 'Procesando datos'}... Por favor espera.</span>`;
            btnSubmit.disabled = true;
            btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');

            // Verificar autenticación
            const user = auth.currentUser;
            if (!user) {
                throw new Error("No estás autenticado. Por favor inicia sesión.");
            }

            // ==========================================
            // A. SUBIR IMÁGENES DE PORTADA A STORAGE
            // ==========================================
            const imageUrls = [];
            for (let i = 0; i < previewFiles.length; i++) {
                const file = previewFiles[i];
                const timestamp = Date.now();
                const fileName = `${timestamp}_${i}_${file.name}`;
                const storageRef = ref(storage, `previews/${fileName}`);

                const snapshot = await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(snapshot.ref);
                imageUrls.push(downloadUrl);
            }

            // ==========================================
            // B. SUBIR ARCHIVO O USAR URL
            // ==========================================
            let productUrl = null;
            let fileType = null;

            if (deliveryType === 'file') {
                // Subir archivo a Storage
                const timestamp = Date.now();
                const productFileName = `${timestamp}_${productFile.name}`;
                const productStorageRef = ref(storage, `products/${productFileName}`);

                const productSnapshot = await uploadBytes(productStorageRef, productFile);
                productUrl = await getDownloadURL(productSnapshot.ref);
                fileType = productFile.name.split('.').pop().toLowerCase();
            } else {
                // Modo URL: usar la URL proporcionada
                productUrl = accessUrl;
                fileType = 'url';
            }

            // ==========================================
            // C. GENERAR KEYWORDS INTELIGENTES
            // ==========================================
            const keywords = generateKeywords(title, description, selecciones);

            // ==========================================
            // D. GUARDAR EN FIRESTORE
            // ==========================================
            const productData = {
                // Información del creador
                creador_uid: user.uid,
                creador_nombre: user.displayName || "English To Go",
                creador_foto: user.photoURL || "../assets/img/logo.png",

                // Información básica
                titulo: title,
                precio: Number(price),
                es_gratis: isFree, // 🔥 NUEVO: Flag de gratuidad
                descripcion: description,
                fecha_creacion: serverTimestamp(),

                // 🔥 NUEVO: Tipo de entrega
                tipo_entrega: deliveryType, // 'file' o 'url'

                // Clasificación principal (obligatoria)
                levels: selecciones.levels,
                skills: selecciones.skills,
                types: selecciones.types,

                // Clasificación detallada (opcional)
                exams: selecciones.exams,
                tenses: selecciones.tenses,
                grammar: selecciones.grammar,
                context: selecciones.context,

                // Archivos
                imagenes_preview: imageUrls,
                tipo_archivo: fileType,

                // 🔥 Motor de búsqueda - Keywords inteligentes
                keywords: keywords
            };

            // Agregar campos según el tipo de entrega
            if (deliveryType === 'file') {
                productData.url_archivo = productUrl;
                productData.url_acceso = null;
            } else {
                productData.url_acceso = productUrl;
                productData.url_archivo = null;
            }

            await addDoc(collection(db, "products"), productData);

            // ==========================================
            // E. ÉXITO - LIMPIAR Y REDIRIGIR
            // ==========================================
            const successMessage = deliveryType === 'file'
                ? '¡Material Publicado Exitosamente!'
                : '¡Web App Publicada Exitosamente!';

            status.innerHTML = `
                <div class="bg-green-100 text-green-700 p-4 rounded-lg mt-4 border border-green-400">
                    ✅ ${successMessage} Redirigiendo al panel...
                </div>
            `;

            // Limpiar formulario
            form.reset();
            Object.keys(selecciones).forEach(k => selecciones[k] = []);
            document.querySelectorAll('.selected-tags').forEach(el => el.innerHTML = '');
            previewContainer.innerHTML = "";
            previewCount.innerText = "Sin selección";
            productFileName.innerHTML = '<span class="text-slate-400 font-normal">Ningún archivo seleccionado</span>';
            charCount.innerText = "0";

            // Resetear a modo archivo
            if (deliveryFileRadio) deliveryFileRadio.checked = true;
            toggleDeliveryMode();

            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 2000);

        } catch (error) {
            console.error("Error al publicar material:", error);
            status.innerHTML = `
                <div class="bg-red-100 text-red-700 p-4 rounded-lg mt-4 border border-red-400">
                    ❌ Error: ${error.message}
                </div>
            `;
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}
