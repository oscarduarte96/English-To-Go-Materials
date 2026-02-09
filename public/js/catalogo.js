/**
 * ============================================================================
 * VISTA DEL CATÁLOGO (CATALOGO.JS) - VERSIÓN CLIENT-SIDE (ROBUSTA)
 * ============================================================================
 * Estrategia: Descargar todo una vez -> Filtrar en memoria.
 * Evita errores de índices compuestos en Firebase.
 */

// 1. IMPORTACIONES
import { db, auth } from "../../assets/js/firebase-app.js";
import {
    collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import ProductModal from "./product-modal.js";

// 2. CONFIGURACIÓN (CATEGORÍAS)
const CATEGORIAS = {
    levels: ["Pre-A1 (Starters / Pre-school)", "A1 (Beginner)", "A1-A2 (High Beginner)", "A2 (Elementary)", "B1 (Intermediate)", "B1+ (Intermediate Plus)", "B2 (Upper Intermediate)", "C1 (Advanced)", "C2 (Proficiency)", "Multi-level (Adaptable)", "Adult Education", "Homeschooling"],
    skills: ["Speaking (Conversación)", "Listening (Escucha)", "Reading Comprehension", "Writing (Escritura)", "Grammar (Gramática)", "Vocabulary (Vocabulario)", "Pronunciation / Phonetics", "Spelling (Ortografía)", "Phonics", "Critical Thinking", "Translation"],
    types: ["Worksheet (Hoja de trabajo)", "Flashcards (Tarjetas)", "Game / Board Game", "PowerPoint / Slides", "Lesson Plan (Plan de Clase)", "Exam / Quiz / Assessment", "Project Based Learning", "Interactive Notebook", "Video Guide", "Song / Music Activity", "Role Play Script", "Ice Breakers", "Poster / Decoration", "Infographic", "Cut-outs / Craft"],
    exams: ["TOEFL iBT", "TOEFL ITP", "TOEFL Primary/Junior", "IELTS Academic", "IELTS General Training", "Cambridge: A2 Key (KET)", "Cambridge: B1 Preliminary (PET)", "Cambridge: B2 First (FCE)", "Cambridge: C1 Advanced (CAE)", "Cambridge: C2 Proficiency (CPE)", "TOEIC (Listening & Reading)", "TOEIC (Speaking & Writing)", "MET (Michigan)", "Duolingo English Test", "Trinity (GESE/ISE)", "APTIS", "PTE Academic"],
    grammar: ["Nouns", "Pronouns", "Adjectives", "Adverbs", "Prepositions", "Articles", "Comparatives & Superlatives", "Modals", "Gerunds & Infinitives", "Phrasal Verbs", "Question Tags", "Relative Clauses", "Conjunctions", "Quantifiers", "Word Order", "Prefixes & Suffixes", "Collocations", "Idioms"],
    context: ["Business English", "Travel & Tourism", "Medical English", "Legal English", "Aviation English", "Daily Routine", "Family & Friends", "Food & Cooking", "Shopping", "Clothes & Fashion", "Animals & Nature", "Sports & Hobbies", "Technology & Social Media", "Environment", "School & Education", "Jobs & Professions", "Weather & Seasons", "Halloween", "Christmas", "Thanksgiving", "Easter", "Valentine's Day", "Summer Holidays", "Movies & TV", "Music & Arts"]
};

// 3. ESTADO LOCAL (EN MEMORIA)
const localState = {
    allProducts: [],      // Todos los productos descargados de Firebase
    allTeachers: [],      // Todos los profesores (para búsqueda por nombre)
    filteredProducts: [], // Subconjunto que cumple los filtros actuales
    visibleLimit: 12,     // Cuántos mostramos actualmente (paginación virtual)
    pageSize: 12,         // Cuántos más añadir al dar "Cargar más"
    isLoading: false,
    currentProduct: null, // Producto actual en el modal
    filters: {
        search: "",
        level: "",
        skill: "",
        grammar: "",
        type: "",
        context: "",
        exam: "",
        teacherId: null,
        teacherId: null,
        price: ""
    },
    purchasedProductIds: new Set() // IDs de productos ya comprados
};

// 4. REFERENCIAS AL DOM
const ui = {
    sidebar: document.getElementById('sidebar'),
    mobileOverlay: document.getElementById('mobileOverlay'),
    teachersList: document.getElementById('teachersList'),
    teacherSearch: document.getElementById('teacherSearch'),
    searchContainer: document.getElementById('searchContainer'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    toggleFiltersBtn: document.getElementById('toggleFiltersBtn'),
    filtersContainer: document.getElementById('filtersContainer'),
    resetBtn: document.getElementById('resetFilters'),
    filterChevron: document.getElementById('filterChevron'),
    selects: {
        level: document.getElementById('filter-level'),
        skill: document.getElementById('filter-skill'),
        grammar: document.getElementById('filter-grammar'),
        type: document.getElementById('filter-type'),
        context: document.getElementById('filter-context'),
        exam: document.getElementById('filter-exam'),
        price: document.getElementById('filter-price')
    },
    grid: document.getElementById('grid-productos'),
    resultCount: document.getElementById('resultCount'),
    noResults: document.getElementById('noResults'),
    loadMoreContainer: null,
    scrollArea: document.getElementById('main-scroll-area'),
    // Teacher Discovery
    teacherResultsContainer: document.getElementById('teacherResultsContainer'),
    teacherResultsGrid: document.getElementById('teacherResultsGrid'),
    // Modal References
    modal: {
        container: document.getElementById('productModal'),
        backdrop: document.getElementById('productModalBackdrop'),
        panel: document.getElementById('productModalPanel'),
        btnClose: document.getElementById('btnCloseModal'),
        // img: document.getElementById('modalImg'), // DEPRECATED: Usamos galleryContainer
        galleryContainer: document.getElementById('modalGalleryContainer'),
        // typeBadge: document.getElementById('modalTypeBadge'), // DEPRECATED: Se genera dinámicamente
        levelTag: document.getElementById('modalLevelTag'),
        title: document.getElementById('modalTitle'),
        teacherImg: document.getElementById('modalTeacherImg'),
        teacherName: document.getElementById('modalTeacherName'),
        desc: document.getElementById('modalDesc'),
        skill: document.getElementById('modalSkill'),
        grammar: document.getElementById('modalGrammar'),
        price: document.getElementById('modalPrice'),
        btnAdd: document.getElementById('modalBtnAdd'),
        btnShare: document.getElementById('modalBtnShare')
    }
};

/**
 * 5. INICIALIZACIÓN
 */
async function init() {
    createLoadMoreButton();
    populateSelects();
    setupEvents();
    ProductModal.init(); // Usar modulo compartido
    setupCreatorCta(); // CTA visibility for logged-in non-creators

    // Carga paralela: Profesores y Productos
    await Promise.all([
        fetchTeachers(),
        fetchAllProducts()
    ]);
}

/**
 * Show Creator CTA only for logged-in users who are NOT already creators.
 */

function setupCreatorCta() {
    const creatorCta = document.getElementById('creatorCta');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("[Auth] User not logged in.");
            if (creatorCta) creatorCta.classList.add('hidden');
            localState.purchasedProductIds.clear();
            if (window.appState) window.appState.purchasedProductIds = new Set();
            renderGrid(); // Re-render to clear "Purchased" status
            return;
        }

        // 1. Cargar Compras del Usuario
        await fetchUserPurchases(user.uid);

        // 2. Lógica Creator CTA
        if (creatorCta) {
            try {
                const userRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const isTeacher = !!(data.roles && data.roles.teacher);

                    if (!isTeacher) {
                        creatorCta.classList.remove('hidden');
                    } else {
                        creatorCta.classList.add('hidden');
                    }
                }
            } catch (error) {
                console.error("[CreatorCTA] Error checking user role:", error);
            }
        }
    });
}

function createLoadMoreButton() {
    if (document.getElementById('loadMoreContainer')) return;

    const container = document.createElement('div');
    container.id = "loadMoreContainer";
    container.className = "col-span-full flex justify-center py-8 hidden";
    container.innerHTML = `
        <button id="btnLoadMore" class="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-2">
            <span>Cargar más materiales</span>
            <i class="fa-solid fa-chevron-down text-xs"></i>
        </button>
    `;
    ui.grid.parentNode.appendChild(container);
    ui.loadMoreContainer = container;

    const btn = document.getElementById('btnLoadMore');
    if (btn) btn.onclick = () => {
        localState.visibleLimit += localState.pageSize;
        renderGrid();
    };
}

function populateSelects() {
    const fill = (sel, arr) => {
        if (!sel) return;
        while (sel.options.length > 1) { sel.remove(1); }
        arr.forEach(txt => sel.add(new Option(txt, txt)));
    };
    if (ui.selects.level) fill(ui.selects.level, CATEGORIAS.levels);
    if (ui.selects.skill) fill(ui.selects.skill, CATEGORIAS.skills);
    if (ui.selects.grammar) fill(ui.selects.grammar, CATEGORIAS.grammar);
    if (ui.selects.type) fill(ui.selects.type, CATEGORIAS.types);
    if (ui.selects.context) fill(ui.selects.context, CATEGORIAS.context);
    if (ui.selects.exam) fill(ui.selects.exam, CATEGORIAS.exams);
}

function setupEvents() {
    window.addEventListener('toggle-sidebar', () => toggleSidebar());
    if (ui.mobileOverlay) ui.mobileOverlay.onclick = () => toggleSidebar(false);

    window.addEventListener('toggle-search', () => {
        const isCurrentlyHidden = !ui.searchContainer.classList.contains('search-open');

        if (isCurrentlyHidden) {
            // Show search (slide down with transition)
            ui.searchContainer.classList.add('search-open');
            setTimeout(() => ui.searchInput.focus(), 100);
        } else {
            // Hide search (slide up with transition)
            ui.searchContainer.classList.remove('search-open');
        }
    });

    if (ui.toggleFiltersBtn) {
        ui.toggleFiltersBtn.onclick = () => {
            ui.filtersContainer.classList.toggle('max-h-96');
            ui.filtersContainer.classList.toggle('max-h-0');
            ui.filterChevron.classList.toggle('rotate-180', !ui.filtersContainer.classList.contains('max-h-0'));
        };
    }

    Object.keys(ui.selects).forEach(k => {
        if (ui.selects[k]) ui.selects[k].onchange = (e) => {
            localState.filters[k] = e.target.value;
            applyFilters();
        };
    });

    if (ui.searchInput) {
        ui.searchInput.oninput = window.utils.debounce((e) => {
            localState.filters.search = e.target.value;
            applyFilters();
        }, 300);
    }

    if (ui.teacherSearch) {
        ui.teacherSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = ui.teachersList.querySelectorAll('.teacher-item');
            items.forEach(item => {
                const name = item.getAttribute('data-name');
                if (name.includes(term)) {
                    item.classList.remove('hidden');
                    item.classList.add('flex');
                } else {
                    item.classList.add('hidden');
                    item.classList.remove('flex');
                }
            });
        });
    }

    if (ui.clearSearch) ui.clearSearch.onclick = () => {
        ui.searchInput.value = '';
        localState.filters.search = '';
        applyFilters();
    };

    if (ui.resetBtn) ui.resetBtn.onclick = resetAllFilters;

    // Escuchar cambios globales del carrito para actualizar botones
    window.addEventListener('cart-updated', updateAllCartButtons);
}



/**
 * 6. LÓGICA DE DATOS (PRODUCTOS)
 */
async function fetchAllProducts() {
    if (localState.isLoading) return;
    localState.isLoading = true;
    ui.grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fa-solid fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';

    try {
        const q = query(collection(db, "products"), orderBy("fecha_creacion", "desc"));
        const snapshot = await getDocs(q);

        localState.allProducts = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            localState.allProducts.push({
                id: docSnap.id,
                ...data,
                _img: (data.imagenes_preview && data.imagenes_preview.length) ? data.imagenes_preview[0] : null,
                _searchString: [
                    data.titulo,
                    data.descripcion,
                    data.creador_nombre || data.autor || "English To Go",
                    Array.isArray(data.keywords) ? data.keywords.join(" ") : ""
                ].join(" ").toLowerCase()
            });
        });

        applyFilters();

        // Deep Link: Abrir modal si hay un ID de producto en la URL
        checkDeepLink();

    } catch (e) {
        console.error("Error cargando productos:", e);
        ui.grid.innerHTML = '<div class="col-span-full text-center text-red-500">Hubo un error cargando los materiales. Por favor recarga la página.</div>';
    } finally {
        localState.isLoading = false;
    }
}

/**
 * DEEP LINK: Detecta si la URL tiene parámetro ?id= y abre el modal automáticamente
 */
function checkDeepLink() {
    const productId = window.utils?.getURLParam('id');
    if (!productId) return;

    console.log("[DeepLink] Detected product ID in URL:", productId);

    // Find product in loaded products
    const product = localState.allProducts.find(p => p.id === productId);
    if (product) {
        console.log("[DeepLink] Opening modal for:", product.titulo);
        ProductModal.open(product);
    } else {
        console.warn("[DeepLink] Product not found:", productId);
    }
}

/**
 * 7. LÓGICA DE FILTRADO
 */
function applyFilters() {
    const f = localState.filters;
    localState.visibleLimit = localState.pageSize;

    // --- TEACHER DISCOVERY: Search teachers by name ---
    if (f.search && f.search.length >= 2 && localState.allTeachers.length > 0) {
        const searchLower = f.search.toLowerCase();
        const matchingTeachers = localState.allTeachers.filter(t =>
            t._searchString.includes(searchLower)
        );
        renderTeacherCards(matchingTeachers);
    } else {
        // Hide teacher results when no search or no matches
        if (ui.teacherResultsContainer) {
            ui.teacherResultsContainer.classList.add('hidden');
        }
    }

    localState.filteredProducts = localState.allProducts.filter(p => {
        if (f.search && !p._searchString.includes(f.search.toLowerCase())) return false;
        if (f.teacherId && p.creador_uid != f.teacherId) return false;
        if (f.level && !p.levels?.includes(f.level)) return false;
        if (f.skill && !p.skills?.includes(f.skill)) return false;
        if (f.grammar && !p.grammar?.includes(f.grammar)) return false;
        if (f.type && !p.types?.includes(f.type)) return false;
        if (f.context && !p.context?.includes(f.context)) return false;
        if (f.exam && !p.exams?.includes(f.exam)) return false;

        if (f.price === 'free' && !p.es_gratis) return false;
        if (f.price === 'paid' && p.es_gratis) return false;

        return true;
    });

    updateUIControls();
    renderGrid();
}

/**
 * 7B. TEACHER DISCOVERY - Render Profile Cards
 */
function renderTeacherCards(teachers) {
    if (!ui.teacherResultsContainer || !ui.teacherResultsGrid) return;

    if (teachers.length === 0) {
        ui.teacherResultsContainer.classList.add('hidden');
        return;
    }

    ui.teacherResultsContainer.classList.remove('hidden');
    ui.teacherResultsGrid.innerHTML = '';

    teachers.slice(0, 4).forEach(teacher => {
        // Count products for this teacher
        const productCount = localState.allProducts.filter(p => p.creador_uid === teacher.uid).length;

        const card = document.createElement('div');
        card.className = 'teacher-profile-card';
        card.innerHTML = `
            <img src="${teacher.photoURL}" alt="${teacher.displayName}" class="avatar">
            <div class="info">
                <p class="name">
                    ${teacher.displayName}
                    <span class="badge"><i class="fa-solid fa-check"></i> Creador</span>
                </p>
                <p class="meta">
                    <span><i class="fa-solid fa-box-open"></i> ${productCount} materiales</span>
                </p>
            </div>
            <div class="action">
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        `;

        card.onclick = () => {
            window.location.href = `panel/perfil.html?uid=${teacher.uid}`;
        };

        ui.teacherResultsGrid.appendChild(card);
    });
}

/**
 * 8. RENDERIZADO (UI) MEJORADO - TARJETAS INTERACTIVAS
 */
function renderGrid() {
    const totalFiltered = localState.filteredProducts.length;
    ui.resultCount.innerText = `${totalFiltered} encontrados`;

    if (totalFiltered === 0) {
        ui.grid.innerHTML = "";
        ui.noResults.classList.remove('hidden');
        ui.noResults.classList.add('flex');
        if (ui.loadMoreContainer) ui.loadMoreContainer.classList.add('hidden');
        return;
    }

    ui.noResults.classList.add('hidden');
    ui.noResults.classList.remove('flex');

    const visibleProducts = localState.filteredProducts.slice(0, localState.visibleLimit);
    ui.grid.innerHTML = "";

    visibleProducts.forEach(p => {
        const meta = getFileMeta(p.tipo_archivo, p.tipo_entrega);
        const price = p.es_gratis ? "GRATIS" : (window.utils?.formatCurrency ? window.utils.formatCurrency(p.precio) : `$${p.precio}`);
        const teacherName = p.creador_nombre || p.autor || "English To Go";

        const imgHTML = p._img
            ? `<img src="${p._img}" class="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" loading="lazy">`
            : `<div class="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-5xl">${meta.icon}</div>`;

        let tagsHTML = '';
        if (p.levels) p.levels.slice(0, 2).forEach(l => tagsHTML += `<span class="text-[10px] text-indigo-600 bg-white/60 px-2 py-1 rounded border border-indigo-100 font-bold backdrop-blur-sm">${l.split('(')[0]}</span>`);

        const card = document.createElement('div');
        card.className = "card-enter w-full min-w-[280px] max-w-[400px] sm:max-w-none justify-self-stretch bg-white rounded-2xl shadow-xl border border-slate-200 group flex flex-col h-full cursor-pointer hover:-translate-y-2 transition-all duration-300 overflow-hidden";
        card.setAttribute('data-product-id', p.id);

        const shareBtnId = `btn-share-${p.id}`;
        const addBtnId = `btn-add-${p.id}`;

        card.innerHTML = `
            <!-- Image Section -->
            <div class="relative h-56 w-full overflow-hidden bg-slate-100">
                ${imgHTML}
                <div class="absolute top-2 right-2 z-10 flex gap-1">
                    ${p.es_gratis ? `<span class="file-badge-free text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 tracking-wider shadow-md"><i class="fa-solid fa-gift"></i> GRATIS</span>` : ''}
                    <span class="${meta.class} text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 tracking-wider shadow-md">${meta.icon} ${meta.label}</span>
                </div>
            </div>
            
            <!-- Gradient Bar -->
            <div class="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            
            <!-- Content Section with Flexbox -->
            <div class="flex flex-col flex-grow p-3">
                <!-- Title & Tags -->
                <h3 class="font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm">${p.titulo}</h3>
                <div class="mb-2 flex flex-wrap gap-1">${tagsHTML}</div>
                
                <!-- Spacer to push content to bottom -->
                <div class="flex-grow"></div>
                
                <!-- Teacher Info & Price -->
                <div class="border-t border-slate-100 pt-2 mt-1">
                    <!-- Compact Creator Info -->
                    <div class="flex items-center gap-2 mb-2 cursor-pointer hover:bg-slate-50 rounded-lg p-0.5 -ml-0.5 transition-colors w-fit" id="creator-link-${p.id}">
                        <img src="${p.creador_foto || 'https://i.imgur.com/O1F7GGy.png'}" class="w-5 h-5 rounded-full object-cover border border-slate-200">
                        <span class="text-[10px] text-slate-500">Por <span class="font-bold text-slate-700 hover:text-indigo-600 truncate max-w-[150px] inline-block align-bottom">${teacherName}</span></span>
                    </div>
                    
                    <!-- Action Bar (Compact Grid/Flex) -->
                    <div class="flex items-center gap-2 justify-between">
                        <!-- Price -->
                        <span class="text-sm sm:text-base font-black ${p.es_gratis ? 'text-emerald-600' : 'text-slate-900'} tracking-tight leading-none" title="${price}">${price}</span>
                        
                        <div class="flex items-center gap-1">
                             <!-- Share -->
                            <button id="${shareBtnId}" class="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Compartir">
                                <i class="fa-solid fa-share-nodes text-xs"></i>
                            </button>
                            
                            <!-- Add -->
                            <button id="${addBtnId}" class="h-7 px-3 flex-shrink-0 rounded-lg bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-600 transition-all shadow-sm active:scale-95 btn-quick-add whitespace-nowrap">
                                <i class="fa-solid fa-cart-shopping"></i> <span>Agregar</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        ui.grid.appendChild(card);

        // 1. ENTIRE CARD opens modal
        card.onclick = () => ProductModal.open(p);

        // 2. Botón Share
        document.getElementById(shareBtnId).onclick = (e) => {
            e.stopPropagation();
            handleShare(p);
        };

        // 3. Botón Quick Add
        const addBtn = document.getElementById(addBtnId);
        addBtn.onclick = (e) => {
            e.stopPropagation();
            if (p.es_gratis) {
                handleFreeDownload(p, addBtn);
            } else {
                handleQuickAdd(p, addBtn);
            }
        };

        // 4. Estado Inicial del Botón
        updateButtonState(addBtn, p.id);

        // 5. Creator Link Click
        const creatorLink = document.getElementById(`creator-link-${p.id}`);
        if (creatorLink) {
            creatorLink.onclick = (e) => {
                e.stopPropagation();
                if (p.creador_uid) {
                    window.location.href = `panel/perfil.html?uid=${p.creador_uid}`;
                }
            };
        }
    });

    if (ui.loadMoreContainer) {
        ui.loadMoreContainer.classList.toggle('hidden', visibleProducts.length >= totalFiltered);
    }
}

/**
 * 9. LÓGICA DEL MODAL CON CAROUSEL
 */
/**
 * 10. INTERACCIONES INTELIGENTES (ADD & SHARE)
 * Replaced modal logic with ProductModal.js
 */

/**
 * 10. INTERACCIONES INTELIGENTES (ADD & SHARE)
 */
function getCartButtonState(productId) {
    if (!window.appState || !window.appState.cart) return { inCart: false };
    return {
        inCart: window.appState.cart.some(item => item.id === productId)
    };
}

function updateButtonState(btnElement, productId) {
    if (!btnElement) return;
    const state = getCartButtonState(productId);
    const isGrid = btnElement.classList.contains('btn-quick-add');
    const heightClass = isGrid ? 'h-7' : 'h-14'; // Grid compact vs Modal larger
    const minHeightClass = isGrid ? 'min-h-[28px]' : 'min-h-[56px]';

    // 0. Mirar SI YA FUE COMPRADO (Prioridad Máxima)
    if (localState.purchasedProductIds.has(productId)) {
        // Estado: YA COMPRADO
        btnElement.className = btnElement.className.replace(/bg-slate-900|hover:bg-indigo-600|bg-emerald-50|text-emerald-600|border-emerald-200/g, '');
        btnElement.classList.remove('bg-emerald-600', 'text-white', 'hover:bg-emerald-700', 'shadow-emerald-200', 'text-slate-900', 'bg-slate-900', 'hover:bg-indigo-600');

        // Mobile Layout Fix: Full width, auto height to prevent overflow
        btnElement.classList.remove('h-9', 'h-7', 'h-11', 'whitespace-nowrap');
        btnElement.classList.add('bg-indigo-50', 'text-indigo-600', 'border', 'border-indigo-200', 'cursor-pointer', 'w-full', 'h-auto', isGrid ? 'py-1' : 'py-3', minHeightClass);

        if (isGrid) {
            btnElement.innerHTML = `<i class="fa-solid fa-check-circle"></i> <span class="text-[10px]">Biblioteca</span>`;
        } else {
            btnElement.innerHTML = `<i class="fa-solid fa-check-circle"></i> <span class="text-xs sm:text-sm">Adquirido • Ver en Biblioteca</span>`;
        }

        // Cambiar acción al hacer click para ir a la biblioteca
        btnElement.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'panel/biblioteca.html';
        };
        btnElement.disabled = false;
        return;
    }

    // Reset styles for non-purchased states (restore standard shape)
    btnElement.classList.add(heightClass, 'whitespace-nowrap');
    btnElement.classList.remove('w-full', 'h-auto', 'py-2', 'py-1', 'py-3', 'min-h-[36px]', 'min-h-[28px]', 'min-h-[44px]');

    // 1. Mirar si es GRATIS
    const product = localState.allProducts.find(p => p.id === productId);
    if (product?.es_gratis) {
        // Estilo "DESCARGAR"
        btnElement.className = btnElement.className.replace(/bg-slate-900|hover:bg-indigo-600|bg-emerald-50|text-emerald-600|border-emerald-200/g, '');
        btnElement.classList.add('bg-emerald-600', 'text-white', 'hover:bg-emerald-700', 'shadow-emerald-200');

        // Texto según contexto
        if (btnElement.id === 'modalBtnAdd') {
            btnElement.innerHTML = `<span>Descargar Ahora</span> <i class="fa-solid fa-cloud-arrow-down group-hover:animate-bounce"></i>`;
            btnElement.classList.add('shadow-lg', 'shadow-emerald-200');
        } else {
            btnElement.innerHTML = `<i class="fa-solid fa-download"></i> Descargar`;
            btnElement.classList.add('bg-emerald-600', 'text-white'); // Re-force just in case
        }
        btnElement.disabled = false;
        return;
    }

    if (state.inCart) {
        // Estado: YA EN CARRITO
        btnElement.classList.remove('bg-slate-900', 'hover:bg-indigo-600', 'text-white');
        btnElement.classList.add('bg-emerald-50', 'text-emerald-600', 'border', 'border-emerald-200');
        btnElement.innerHTML = `<i class="fa-solid fa-check"></i> <span>Añadido</span>`;
        // Opcional: Deshabilitar o cambiar funcionalidad a "Ver Carrito"
        // btnElement.disabled = true;
    } else {
        // Estado: DISPONIBLE PARA AGREGAR
        btnElement.classList.add('bg-slate-900', 'text-white');
        btnElement.classList.remove('bg-emerald-50', 'text-emerald-600', 'border', 'border-emerald-200', 'bg-indigo-50', 'text-indigo-700', 'border-indigo-200');
        // Restauramos estilos hover según donde esté el botón
        if (btnElement.id === 'modalBtnAdd') {
            btnElement.classList.add('hover:bg-indigo-600');
            btnElement.innerHTML = `<span>Agregar al Carrito</span> <i class="fa-solid fa-cart-plus group-hover:animate-bounce"></i>`;
        } else {
            // Botón Grid
            btnElement.classList.add('hover:bg-indigo-600');
            btnElement.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Agregar`;
        }
        btnElement.disabled = false;
    }
}

/**
 * Carga las compras del usuario para verificar propiedad
 */
async function fetchUserPurchases(uid) {
    try {
        const q = query(collection(db, "orders"), where("user_id", "==", uid), where("status", "==", "completed"));
        const snapshot = await getDocs(q);

        localState.purchasedProductIds.clear();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    if (item.id) localState.purchasedProductIds.add(item.id);
                });
            }
        });

        // Exponer a global para otros módulos (ProductModal)
        window.appState = window.appState || {};
        window.appState.purchasedProductIds = localState.purchasedProductIds;

        console.log(`[Purchases] Loaded ${localState.purchasedProductIds.size} purchased items.`);

        // Actualizar UI
        renderGrid();
        updateAllCartButtons();

    } catch (e) {
        console.error("Error loading usage purchases:", e);
    }
}

function updateAllCartButtons() {
    // 1. Grid
    document.querySelectorAll('.btn-quick-add').forEach(btn => {
        // Sacamos el ID del ID del padre o atributo data (lo puse en el padre card)
        const card = btn.closest('.card-enter');
        if (card) {
            const pid = card.getAttribute('data-product-id');
            updateButtonState(btn, pid);
        }
    });

    // 2. Modal (si está abierto)
    if (localState.currentProduct && !ui.modal.container.classList.contains('hidden')) {
        updateButtonState(ui.modal.btnAdd, localState.currentProduct.id);
    }
}

async function handleQuickAdd(product, btnElement) {
    const state = getCartButtonState(product.id);

    if (state.inCart) {
        // Si ya está, abrimos el carrito para que finalice compra
        window.dispatchEvent(new CustomEvent('toggle-cart'));
    } else {
        // Agregar
        btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        await window.addToCart(product); // Viene de cart.js
        // La actualización visual ocurre via evento 'cart-updated' -> updateAllCartButtons
    }
}

async function handleShare(product) {
    const url = `${window.location.origin}/catalogo.html?id=${product.id}`;
    // Texto persuasivo
    const priceText = product.es_gratis ? "¡Es GRATIS!" : `Cuesta solo $${product.precio}`;
    const text = `🔥 ¡Profe, mira este material! "${product.titulo}" te va a ahorrar horas de planeación. ${priceText}. Descárgalo aquí:`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: product.titulo,
                text: text,
                url: url
            });
        } else {
            await navigator.clipboard.writeText(`${text} ${url}`);
            if (window.utils?.showToast) {
                window.utils.showToast("¡Enlace copiado al portapapeles!");
            } else {
                alert("¡Enlace copiado al portapapeles! Compártelo donde quieras.");
            }
        }
    } catch (err) {
        console.error("Error compartiendo:", err);
    }
}

/**
 * PROCESO DE DESCARGA DIRECTA (Solo Gratuitos)
 */
async function handleFreeDownload(product, btnElement) {
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

        window.location.href = './auth/login.html?mode=register';
        return;
    }

    // UI Loading
    const originalText = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';

    try {
        // Crear orden "completed" directamente
        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: [{
                id: product.id,
                titulo: product.titulo,
                precio: 0,
                imagen: product._img || null,
                tipo: product.tipo_archivo || 'Digital',
                autor_id: product.creador_uid || 'unknown'
            }],
            original_total: 0,
            discount_amount: 0,
            final_total: 0,
            currency: 'COP',
            status: 'completed',
            payment_method: 'free_download',
            created_at: serverTimestamp(),
            platform: 'web_catalog_direct'
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("Descarga registrada con ID:", docRef.id);

        // Éxito visual
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> ¡Listo!';

        setTimeout(() => {
            alert("¡Material añadido a tu biblioteca!");
            window.location.href = './panel/biblioteca.html';
        }, 500);

    } catch (error) {
        console.error("Error procesando descarga:", error);
        alert("Hubo un error al procesar la descarga. Intenta nuevamente.");
        btnElement.disabled = false;
        btnElement.innerHTML = originalText;
    }
}

/**
 * 11. PROFESORES Y UTILS
 */
async function fetchTeachers() {
    if (!ui.teachersList) return;
    try {
        const q = query(collection(db, "users"), where("roles.teacher", "==", true));
        const snapshot = await getDocs(q);
        ui.teachersList.innerHTML = '';

        // Reset and cache all teachers for search
        localState.allTeachers = [];

        const allBtn = document.createElement('div');
        const isAllActive = localState.filters.teacherId === null;
        allBtn.className = `teacher-item cursor-pointer rounded-lg p-2 flex items-center gap-3 transition-colors ${isAllActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`;
        allBtn.setAttribute('data-name', 'todos all english to go');
        allBtn.innerHTML = `<div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><i class="fa-solid fa-users text-xs"></i></div><span class="text-xs font-bold ${isAllActive ? 'text-indigo-700' : 'text-slate-600'}">Todos</span>`;
        allBtn.onclick = () => selectTeacher(null);
        ui.teachersList.appendChild(allBtn);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const realTeacherId = data.uid || docSnap.id;

            // Cache teacher for search
            localState.allTeachers.push({
                uid: realTeacherId,
                displayName: data.displayName || 'Profesor',
                photoURL: data.photoURL || 'https://i.imgur.com/O1F7GGy.png',
                bio: data.bio || '',
                email: data.email || '',
                _searchString: [
                    data.displayName || '',
                    data.bio || '',
                    data.email || ''
                ].join(' ').toLowerCase()
            });

            const isActive = localState.filters.teacherId === realTeacherId;

            // 1. Container Row
            const row = document.createElement('div');
            row.className = `teacher-item cursor-pointer rounded-lg p-2 flex items-center justify-between transition-colors group ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`;
            row.setAttribute('data-name', (data.displayName || 'profesor').toLowerCase());

            // 2. Left Side: Avatar + Info (Triggers Filter)
            const left = document.createElement('div');
            left.className = "flex items-center gap-3 flex-1 min-w-0";
            left.innerHTML = `
                <img src="${data.photoURL || 'https://i.imgur.com/O1F7GGy.png'}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
                <div class="flex flex-col overflow-hidden">
                    <span class="text-xs font-bold truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}">
                        ${data.displayName || 'Profesor'}
                    </span>
                    ${isActive ? '<span class="text-[9px] text-indigo-500 font-medium">Seleccionado</span>' : ''}
                </div>
            `;

            // Filter Action (Main Click)
            row.onclick = () => selectTeacher(realTeacherId);

            // 3. Right Side: Action Buttons
            const right = document.createElement('div');
            right.className = "flex items-center gap-1 pl-2";

            // Button: View Profile
            const btnView = document.createElement('button');
            btnView.className = "w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 transition-colors";
            btnView.title = "Ver Perfil Público";
            btnView.innerHTML = '<i class="fa-solid fa-eye text-xs"></i>';
            btnView.onclick = (e) => {
                e.stopPropagation(); // Stop Filter
                window.location.href = `panel/perfil.html?uid=${realTeacherId}`;
            };

            // Button: Share Profile
            const btnShare = document.createElement('button');
            btnShare.className = "w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-cyan-600 hover:bg-cyan-100 transition-colors";
            btnShare.title = "Compartir Perfil";
            btnShare.innerHTML = '<i class="fa-solid fa-share-nodes text-xs"></i>';
            btnShare.onclick = async (e) => {
                e.stopPropagation(); // Stop Filter
                const url = `${window.location.origin}/panel/perfil.html?uid=${realTeacherId}`;
                const text = `¡Mira el perfil de ${data.displayName || 'este creador'} en English To Go!`;

                if (window.utils && window.utils.shareContent) {
                    await window.utils.shareContent({
                        title: 'English To Go - Perfil de Creador',
                        text: text,
                        url: url
                    });
                } else {
                    console.error("Utils not loaded");
                }
            };

            right.appendChild(btnView);
            right.appendChild(btnShare);

            row.appendChild(left);
            row.appendChild(right);
            ui.teachersList.appendChild(row);
        });

        console.log(`[Teachers] Cached ${localState.allTeachers.length} teachers for search`);
    } catch (e) {
        console.error("[CRITICAL] Error fetching teachers. Check Firestore Rules or Network:", e);
        ui.teachersList.innerHTML = '<div class="p-4 text-red-500 text-xs">Error cargando profesores.</div>';
    }
}

function selectTeacher(id) {
    localState.filters.teacherId = id;
    fetchTeachers();
    applyFilters();
    if (window.innerWidth < 1024) toggleSidebar(false);
}

function updateUIControls() {
    const f = localState.filters;
    const active = f.search || f.level || f.skill || f.grammar || f.type || f.context || f.exam || f.teacherId || f.price;
    if (ui.resetBtn) ui.resetBtn.classList.toggle('hidden', !active);
    if (ui.clearSearch) ui.clearSearch.classList.toggle('hidden', !f.search);
}

function resetAllFilters() {
    localState.filters = { search: "", level: "", skill: "", grammar: "", type: "", context: "", exam: "", teacherId: null, price: "" };
    if (ui.searchInput) ui.searchInput.value = "";
    Object.values(ui.selects).forEach(s => s.value = "");
    if (ui.teacherSearch) ui.teacherSearch.value = "";
    fetchTeachers();
    applyFilters();
}

function toggleSidebar(forceOpen = null) {
    if (!ui.sidebar) return;
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) {
        ui.sidebar.classList.toggle('collapsed');
    } else {
        const open = forceOpen !== null ? forceOpen : !ui.sidebar.classList.contains('mobile-open');
        ui.sidebar.classList.toggle('mobile-open', open);
        if (ui.mobileOverlay) {
            ui.mobileOverlay.classList.toggle('hidden', !open);
            setTimeout(() => ui.mobileOverlay.classList.toggle('opacity-0', !open), 10);
            ui.mobileOverlay.style.pointerEvents = open ? 'auto' : 'none';
        }
    }
}

function getFileMeta(t, deliveryType = 'file') {
    // 1. Si es Web App / URL
    if (deliveryType === 'url') {
        return {
            icon: '<i class="fa-solid fa-globe"></i>',
            label: 'WEB APP 🌐',
            class: 'bg-cyan-500 text-white'
        };
    }

    // 2. Si es Archivo
    t = (t || '').toLowerCase();
    if (['zip', 'rar'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-zipper"></i>', label: 'Descargable: ZIP', class: 'bg-amber-500 text-white' };
    if (['ppt', 'pptx'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-powerpoint"></i>', label: 'Descargable: PPT', class: 'bg-orange-500 text-white' };
    if (['doc', 'docx'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-word"></i>', label: 'Descargable: DOC', class: 'bg-blue-600 text-white' };
    if (['jpg', 'jpeg', 'png', 'webp'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-image"></i>', label: 'Descargable: IMG', class: 'bg-purple-600 text-white' };

    // Default PDF
    return { icon: '<i class="fa-solid fa-file-pdf"></i>', label: 'Descargable: PDF', class: 'bg-red-500 text-white' };
}

document.addEventListener('DOMContentLoaded', init);