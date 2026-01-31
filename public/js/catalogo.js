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
        price: ""
    }
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
    setupModalLogic(); // Nueva lógica del modal
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
    if (!creatorCta) {
        console.warn("[CreatorCTA] Element #creatorCta not found in DOM.");
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("[CreatorCTA] User not logged in. Hiding CTA.");
            creatorCta.classList.add('hidden');
            return;
        }

        try {
            console.log("[CreatorCTA] Checking role for user:", user.uid);
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const isTeacher = !!(data.roles && data.roles.teacher); // Force boolean

                console.log(`[CreatorCTA] Role data loaded. isTeacher=${isTeacher}`);

                if (!isTeacher) {
                    console.log("[CreatorCTA] User is NOT a teacher. Showing CTA.");
                    creatorCta.classList.remove('hidden');
                } else {
                    console.log("[CreatorCTA] User IS a teacher. Keeping CTA hidden.");
                    // Ensure it stays hidden if they are a teacher
                    creatorCta.classList.add('hidden');
                }
            } else {
                console.warn("[CreatorCTA] User document does not exist in Firestore.");
            }
        } catch (error) {
            console.error("[CreatorCTA] Error checking user role:", error);
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
        ui.searchContainer.classList.toggle('hidden');
        if (!ui.searchContainer.classList.contains('hidden')) ui.searchInput.focus();
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

function setupModalLogic() {
    if (!ui.modal.container) return;

    const close = () => closeProductModal();
    ui.modal.btnClose.onclick = close;
    ui.modal.backdrop.onclick = close;

    // Add to Cart en Modal
    // Add to Cart en Modal
    ui.modal.btnAdd.onclick = () => {
        if (localState.currentProduct) {
            if (localState.currentProduct.es_gratis) {
                handleFreeDownload(localState.currentProduct, ui.modal.btnAdd);
            } else {
                handleQuickAdd(localState.currentProduct, ui.modal.btnAdd);
            }
        }
    };

    // Share en Modal
    ui.modal.btnShare.onclick = () => {
        if (localState.currentProduct) {
            handleShare(localState.currentProduct);
        }
    };

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !ui.modal.container.classList.contains('hidden')) {
            close();
        }
    });
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

    } catch (e) {
        console.error("Error cargando productos:", e);
        ui.grid.innerHTML = '<div class="col-span-full text-center text-red-500">Hubo un error cargando los materiales. Por favor recarga la página.</div>';
    } finally {
        localState.isLoading = false;
    }
}

/**
 * 7. LÓGICA DE FILTRADO
 */
function applyFilters() {
    const f = localState.filters;
    localState.visibleLimit = localState.pageSize;

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
                <div class="absolute top-3 right-3 z-10 flex gap-2">
                    ${p.es_gratis ? `<span class="file-badge-free text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-2 tracking-wider shadow-lg"><i class="fa-solid fa-gift"></i> GRATIS</span>` : ''}
                    <span class="${meta.class} text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-2 tracking-wider shadow-lg">${meta.icon} ${meta.label}</span>
                </div>
            </div>
            
            <!-- Gradient Bar -->
            <div class="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            
            <!-- Content Section with Flexbox -->
            <div class="flex flex-col flex-grow p-5">
                <!-- Title & Tags -->
                <h3 class="font-bold text-slate-800 leading-snug mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2 text-base">${p.titulo}</h3>
                <div class="mb-4 flex flex-wrap gap-1">${tagsHTML}</div>
                
                <!-- Spacer to push content to bottom -->
                <div class="flex-grow"></div>
                
                <!-- Teacher Info -->
                <div class="border-t border-slate-100 pt-4">
                    <div class="flex flex-col gap-1 mb-3">
                        <span class="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Creado por</span>
                        <div class="flex items-center gap-2">
                            <img src="${p.creador_foto || 'https://i.imgur.com/O1F7GGy.png'}" class="w-6 h-6 rounded-full object-cover border border-slate-200">
                            <span class="text-xs text-slate-700 font-bold truncate">${teacherName}</span>
                        </div>
                    </div>
                    
                    <!-- Action Bar (Responsive Grid/Flex) -->
                    <div class="flex items-center gap-2 pt-2 lg:grid lg:grid-cols-[1fr_auto] lg:gap-x-0 lg:gap-y-3 lg:pt-0">
                        <!-- Price: Left on Mobile, Top-Left on Desktop -->
                        <span class="text-base md:text-lg font-black ${p.es_gratis ? 'text-emerald-600' : 'text-slate-900'} tracking-tight leading-tight mr-auto lg:mr-0 lg:col-start-1 lg:row-start-1" title="${price}">${price}</span>
                        
                        <!-- Share: Right next to Add on Mobile, Top-Right on Desktop -->
                        <button id="${shareBtnId}" class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors lg:col-start-2 lg:row-start-1 lg:justify-self-end" title="Compartir">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                        
                        <!-- Add: Right on Mobile, Full Width Bottom on Desktop -->
                        <button id="${addBtnId}" class="h-9 px-4 flex-shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-md active:scale-95 btn-quick-add whitespace-nowrap lg:col-span-2 lg:row-start-2 lg:w-full lg:h-10 lg:text-sm lg:rounded-xl">
                            <i class="fa-solid fa-cart-shopping"></i> <span>Agregar</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        ui.grid.appendChild(card);

        // 1. ENTIRE CARD opens modal
        card.onclick = () => openProductModal(p);

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
    });

    if (ui.loadMoreContainer) {
        ui.loadMoreContainer.classList.toggle('hidden', visibleProducts.length >= totalFiltered);
    }
}

/**
 * 9. LÓGICA DEL MODAL CON CAROUSEL
 */
function openProductModal(p) {
    localState.currentProduct = p;
    const m = ui.modal;

    // 1. Render Gallery (Multi-image CAROUSEL)
    if (m.galleryContainer) {
        m.galleryContainer.innerHTML = ''; // Clear previous

        const images = (p.imagenes_preview && p.imagenes_preview.length)
            ? p.imagenes_preview
            : (p._img ? [p._img] : []);

        const meta = getFileMeta(p.tipo_archivo, p.tipo_entrega);

        if (images.length === 0) {
            // Fallback placeholder
            m.galleryContainer.innerHTML = `
                <div class="w-full h-64 md:h-full bg-slate-50 flex items-center justify-center text-slate-300 text-5xl min-h-[300px]">
                    ${meta.icon}
                </div>
            `;
        } else {
            // Create Carousel Structure
            const carouselHTML = `
                <div class="carousel-container">
                    <div class="carousel-track" id="carouselTrack">
                        ${images.map((src, index) => `
                            <div class="carousel-slide">
                                <img src="${src}" loading="${index === 0 ? 'eager' : 'lazy'}" alt="${p.titulo} - imagen ${index + 1}">
                            </div>
                        `).join('')}
                    </div>
                    
                    ${images.length > 1 ? `
                        <!-- Navigation Arrows -->
                        <button class="carousel-nav prev" id="carouselPrev" aria-label="Imagen anterior">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <button class="carousel-nav next" id="carouselNext" aria-label="Siguiente imagen">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                        
                        <!-- Indicators -->
                        <div class="carousel-indicators" id="carouselIndicators">
                            ${images.map((_, index) => `
                                <button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Ir a imagen ${index + 1}"></button>
                            `).join('')}
                        </div>
                        
                        <!-- Counter Badge -->
                        <div class="carousel-counter">
                            <span id="carouselCounter">1</span> / ${images.length}
                        </div>
                    ` : ''}
                </div>
            `;

            m.galleryContainer.innerHTML = carouselHTML;

            // Initialize Carousel Logic (only if multiple images)
            if (images.length > 1) {
                initCarousel(images.length);
            }
        }
    }

    // 2. Populate Info
    m.levelTag.innerText = p.levels ? p.levels.join(", ") : "Nivel General";
    m.title.innerText = p.titulo;
    m.teacherName.innerText = p.creador_nombre || p.autor || "English To Go";
    m.teacherImg.src = p.creador_foto || 'https://i.imgur.com/O1F7GGy.png';
    m.desc.innerText = p.descripcion || "Sin descripción detallada.";

    m.skill.innerText = p.skills ? p.skills.join(", ") : "Varias";
    m.grammar.innerText = p.grammar ? p.grammar.join(", ") : "General";

    const price = p.es_gratis ? "GRATIS" : (window.utils?.formatCurrency ? window.utils.formatCurrency(p.precio) : `$${p.precio}`);
    m.price.innerText = price;

    if (p.es_gratis) {
        m.price.classList.add('text-emerald-600');
        m.price.classList.remove('text-slate-900');
    } else {
        m.price.classList.add('text-slate-900');
        m.price.classList.remove('text-emerald-600');
    }

    // Actualizar estado botón Modal
    updateButtonState(m.btnAdd, p.id);

    // Mostrar (Transiciones CSS manuales si Tailwind no las maneja auto)
    m.container.classList.remove('hidden');

    // Animación Entrada
    setTimeout(() => {
        m.backdrop.classList.remove('opacity-0');
        m.panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        m.panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);

    document.body.style.overflow = 'hidden'; // Lock scroll
}

/**
 * Carousel Logic (Navigation, Touch, Keyboard)
 */
let carouselState = {
    currentIndex: 0,
    totalSlides: 0,
    touchStartX: 0,
    touchEndX: 0,
    track: null,
    indicators: null,
    counter: null
};

function initCarousel(totalSlides) {
    carouselState.currentIndex = 0;
    carouselState.totalSlides = totalSlides;
    carouselState.track = document.getElementById('carouselTrack');
    carouselState.indicators = document.querySelectorAll('.carousel-indicator');
    carouselState.counter = document.getElementById('carouselCounter');

    // Navigation Buttons
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

    if (prevBtn) prevBtn.onclick = () => navigateCarousel(-1);
    if (nextBtn) nextBtn.onclick = () => navigateCarousel(1);

    // Indicators
    carouselState.indicators.forEach((indicator, index) => {
        indicator.onclick = () => goToSlide(index);
    });

    // Touch Support (Swipe)
    if (carouselState.track) {
        carouselState.track.addEventListener('touchstart', handleTouchStart, { passive: true });
        carouselState.track.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Keyboard Navigation (Arrow keys)
    const keyHandler = (e) => {
        if (!ui.modal.container.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') navigateCarousel(-1);
            if (e.key === 'ArrowRight') navigateCarousel(1);
        }
    };
    document.addEventListener('keydown', keyHandler);

    // Cleanup on modal close
    ui.modal.container.dataset.carouselKeyHandler = 'active';
}

function navigateCarousel(direction) {
    carouselState.currentIndex += direction;

    // Loop behavior
    if (carouselState.currentIndex < 0) {
        carouselState.currentIndex = carouselState.totalSlides - 1;
    } else if (carouselState.currentIndex >= carouselState.totalSlides) {
        carouselState.currentIndex = 0;
    }

    updateCarouselView();
}

function goToSlide(index) {
    carouselState.currentIndex = index;
    updateCarouselView();
}

function updateCarouselView() {
    const offset = -carouselState.currentIndex * 100;
    if (carouselState.track) {
        carouselState.track.style.transform = `translateX(${offset}%)`;
    }

    // Update indicators
    carouselState.indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === carouselState.currentIndex);
    });

    // Update counter
    if (carouselState.counter) {
        carouselState.counter.innerText = carouselState.currentIndex + 1;
    }
}

function handleTouchStart(e) {
    carouselState.touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    carouselState.touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = carouselState.touchStartX - carouselState.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left -> next
            navigateCarousel(1);
        } else {
            // Swipe right -> prev
            navigateCarousel(-1);
        }
    }
}

function closeProductModal() {
    const m = ui.modal;
    localState.currentProduct = null;

    // Animación Salida
    m.backdrop.classList.add('opacity-0');
    m.panel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    m.panel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');

    setTimeout(() => {
        m.container.classList.add('hidden');
        document.body.style.overflow = ''; // Unlock scroll
    }, 300);
}

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

    // 0. Mirar si es GRATIS
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
        btnElement.classList.remove('bg-emerald-50', 'text-emerald-600', 'border', 'border-emerald-200');
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
    const url = window.location.href.split('?')[0] + `?id=${product.id}`; // O link directo al producto
    // Texto persuasivo
    const priceText = product.es_gratis ? "¡Es GRATIS!" : `Cuesta solo $${product.precio}`;
    const text = `🔥 ¡Profe, mira este material! "${product.titulo}" te va a ahorrar horas de planeación. ${priceText}. Descárgalo aquí: ${url}`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: product.titulo,
                text: text,
                url: url
            });
        } else {
            await navigator.clipboard.writeText(text);
            alert("¡Enlace copiado al portapapeles! Compártelo donde quieras.");
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
        sessionStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = './auth/login.html';
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
            const isActive = localState.filters.teacherId === realTeacherId;
            const div = document.createElement('div');
            div.className = `teacher-item cursor-pointer rounded-lg p-2 flex items-center gap-3 transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`;
            div.setAttribute('data-name', (data.displayName || 'profesor').toLowerCase());
            div.innerHTML = `<img src="${data.photoURL || 'https://i.imgur.com/O1F7GGy.png'}" class="w-8 h-8 rounded-full object-cover border border-slate-200"><div class="flex flex-col overflow-hidden"><span class="text-xs font-bold truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}">${data.displayName || 'Profesor'}</span>${isActive ? '<span class="text-[9px] text-indigo-500 font-medium">Seleccionado</span>' : ''}</div>`;
            div.onclick = () => selectTeacher(realTeacherId);
            ui.teachersList.appendChild(div);
        });
    } catch (e) { console.error("Error fetching teachers:", e); }
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