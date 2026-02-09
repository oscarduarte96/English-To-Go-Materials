/* =========================================
   BIBLIOTECA LOGIC - ENGLISH TO GO
   Gestiona la visualización y descarga de materiales comprados.
   ========================================= */

import { auth, db } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// 1. Referencias al DOM
const ui = {
    container: document.getElementById('library-container'),
    emptyMsg: document.getElementById('empty-library'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    resultsCount: document.getElementById('resultsCount')
};

// Estado Global
let allResources = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'newest';
let favorites = new Set(); // Set de IDs de productos

// 2. Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
    setupEventListeners();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadLibrary(user.uid);
    } else {
        // Redirigir si no hay usuario (opcional, o manejado por guard.js)
    }
});

// 3. Lógica de Favoritos (LocalStorage)
function loadFavorites() {
    const saved = localStorage.getItem('etg_library_favorites');
    if (saved) {
        favorites = new Set(JSON.parse(saved));
    }
}

function saveFavorites() {
    localStorage.setItem('etg_library_favorites', JSON.stringify([...favorites]));
}

function toggleFavorite(id) {
    if (favorites.has(id)) {
        favorites.delete(id);
    } else {
        favorites.add(id);
    }
    saveFavorites();
    renderLibrary(); // Re-renderizar para actualizar iconos y vista de favoritos
}

// 4. Carga de Datos
async function loadLibrary(uid) {
    try {
        ui.resultsCount.textContent = 'Cargando recursos...';

        const ordersRef = collection(db, "orders");
        // Buscamos todas las órdenes, para luego filtrar
        const q = query(
            ordersRef,
            where("user_id", "==", uid),
            where("status", "==", "completed")
        );

        const querySnapshot = await getDocs(q);
        const productsMap = new Map();

        // Recopilar IDs de productos de todas las órdenes completadas
        // Hack: Usaremos el índice en la iteración como proxy de "fecha" si no tenemos fecha exacta, 
        // pero idealmente 'orders' debería tener 'created_at'.
        // Asumiremos que Firestore devuelve en orden de creación o similar por defecto, 
        // pero para 'newest' mejor usaremos la fecha de la orden si existe.

        const tempOrders = [];
        querySnapshot.forEach(doc => {
            tempOrders.push({ id: doc.id, data: doc.data() });
        });

        // Ordenar órdenes por fecha (si existe created_at) para tener referencia temporal
        tempOrders.sort((a, b) => {
            const dateA = a.data.created_at?.seconds || 0;
            const dateB = b.data.created_at?.seconds || 0;
            return dateB - dateA; // Primero las más recientes
        });

        for (const order of tempOrders) {
            const orderData = order.data;
            const orderDate = orderData.created_at?.seconds || 0;

            if (orderData.items && Array.isArray(orderData.items)) {
                for (const item of orderData.items) {
                    if (!productsMap.has(item.id)) {
                        productsMap.set(item.id, {
                            ...item,
                            purchaseDate: orderDate // Guardamos fecha de compra para ordenar
                        });
                    }
                }
            }
        }

        if (productsMap.size === 0) {
            showEmptyState();
            ui.resultsCount.textContent = '0 Recursos';
            return;
        }

        // Obtener detalles extendidos
        const detailedResources = [];
        for (const [productId, basicInfo] of productsMap) {
            try {
                const productDoc = await getDoc(doc(db, "products", productId));
                let resourceData = {
                    id: productId,
                    purchaseDate: basicInfo.purchaseDate,
                    titulo: basicInfo.titulo,
                    imagen: basicInfo.imagen,
                    tipo_entrega: 'unknown',
                    url: '#',
                    formato: basicInfo.tipo || 'Digital',
                    // Default info
                    autor: 'No disponible',
                    creador_foto: null,
                    levels: [],
                    es_gratis: false
                };

                if (productDoc.exists()) {
                    const productData = productDoc.data();
                    resourceData = {
                        ...resourceData,
                        titulo: productData.titulo,
                        imagen: (productData.imagenes_preview && productData.imagenes_preview.length > 0)
                            ? productData.imagenes_preview[0]
                            : basicInfo.imagen,
                        tipo_entrega: productData.tipo_entrega,
                        url: productData.url_archivo || productData.url_acceso,
                        formato: productData.tipo_archivo || 'Digital',
                        autor: productData.creador_nombre || productData.autor || 'English To Go',
                        creador_foto: productData.creador_foto || productData.autor_foto || null,
                        levels: productData.levels || [],
                        es_gratis: productData.es_gratis || false,
                        // Modal Info
                        // Modal Info
                        descripcion: productData.descripcion || productData.description || '',
                        imagenes_preview: productData.imagenes_preview || [],
                        creador_uid: productData.creador_uid || productData.autor_id || null // Ensure ID is captured
                    };
                }
                detailedResources.push(resourceData);
            } catch (err) {
                console.error(`Error cargando producto ${productId}:`, err);
            }
        }

        allResources = detailedResources;
        renderLibrary();

    } catch (error) {
        console.error("Error cargando biblioteca:", error);
        ui.container.innerHTML = `<p class="text-red-500 font-bold p-6">Hubo un error al cargar tus recursos.</p>`;
    }
}

// 5. Renderizado y Filtros
function renderLibrary() {
    ui.container.innerHTML = '';

    // A. Filtrar por Tipo
    let result = allResources.filter(res => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'favorite') return favorites.has(res.id);
        return res.tipo_entrega === currentFilter;
    });

    // B. Filtrar por Búsqueda
    if (currentSearch) {
        const term = currentSearch.toLowerCase();
        result = result.filter(res =>
            res.titulo.toLowerCase().includes(term) ||
            res.autor.toLowerCase().includes(term)
        );
    }

    // C. Ordenar
    result.sort((a, b) => {
        switch (currentSort) {
            case 'newest':
                return b.purchaseDate - a.purchaseDate;
            case 'oldest':
                return a.purchaseDate - b.purchaseDate;
            case 'az':
                return a.titulo.localeCompare(b.titulo);
            case 'za':
                return b.titulo.localeCompare(a.titulo);
            default:
                return 0;
        }
    });

    // Actualizar Contador
    ui.resultsCount.textContent = `${result.length} Recurso${result.length !== 1 ? 's' : ''}`;

    if (result.length === 0) {
        if (allResources.length === 0) {
            showEmptyState(); // No tiene nada comprado
        } else {
            // Tiene cosas pero no coinciden con la búsqueda/filtro
            ui.container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400">
                    <i class="fa-solid fa-filter-circle-xmark text-4xl mb-4 text-slate-300"></i>
                    <p class="font-medium">No se encontraron recursos con estos filtros.</p>
                </div>
            `;
            ui.container.classList.remove('hidden');
            ui.emptyMsg.classList.add('hidden');
        }
        return;
    }

    ui.emptyMsg.classList.add('hidden');
    ui.container.classList.remove('hidden');

    result.forEach(res => {
        const isFav = favorites.has(res.id);
        const card = document.createElement('div');
        // Usamos la misma estructura base de tarjeta del catálogo
        card.className = "card-enter w-full min-w-[280px] max-w-[400px] sm:max-w-none justify-self-stretch bg-white rounded-2xl shadow-xl border border-slate-200 group flex flex-col h-full cursor-pointer hover:-translate-y-2 transition-all duration-300 overflow-hidden";

        // Click en tarjeta abre modal
        card.onclick = () => openProductModal(res);

        const meta = getFileMeta(res.formato, res.tipo_entrega);
        const isUrl = res.tipo_entrega === 'url';

        // Botón principal
        const btnIcon = isUrl ? 'fa-arrow-up-right-from-square' : 'fa-download';
        const btnText = isUrl ? 'Acceder al Material' : 'Descargar Archivo';
        const primaryBtnColor = isUrl ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-indigo-600 hover:bg-indigo-700';

        // Tags (Levels)
        let tagsHTML = '';
        if (res.levels && Array.isArray(res.levels)) {
            res.levels.slice(0, 2).forEach(l => {
                tagsHTML += `<span class="text-[10px] text-indigo-600 bg-white/60 px-2 py-1 rounded border border-indigo-100 font-bold backdrop-blur-sm">${l.split('(')[0]}</span>`;
            });
        }

        // Teacher Image
        const teacherImg = res.creador_foto || 'https://i.imgur.com/O1F7GGy.png';
        const creatorId = res.creador_uid;

        card.innerHTML = `
            <!-- Image Section -->
            <div class="relative h-56 w-full overflow-hidden bg-slate-100">
                <img src="${res.imagen}" class="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" loading="lazy" alt="${res.titulo}">
                
                <div class="absolute top-2 right-2 z-10 flex gap-1">
                    <span class="${meta.class} text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 tracking-wider shadow-md">
                        ${meta.icon} ${meta.label}
                    </span>
                </div>

                <!-- Botón Favorito Flotante (Maintain functionality but style it slightly smaller/nicer if needed, or keep as is) -->
                <!-- The catalog doesn't have a fav button on card, but library does. We'll keep it but make it subtle. -->
                 <button class="fav-btn absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-sm shadow-md border border-white/50 transition-all hover:scale-110 ${isFav ? 'text-danger' : 'text-slate-400 hover:text-danger'}" 
                        title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart text-xs"></i>
                </button>
            </div>
            
            <!-- Gradient Bar -->
            <div class="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            
            <!-- Content Section with Flexbox (Matches Catalogue p-3) -->
            <div class="flex flex-col flex-grow p-3">
                <!-- Title & Tags -->
                <h3 class="font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm" title="${res.titulo}">
                    ${res.titulo}
                </h3>
                <div class="mb-2 flex flex-wrap gap-1">${tagsHTML}</div>
                
                <!-- Spacer to push content to bottom -->
                <div class="flex-grow"></div>
                
                <!-- Teacher Info & Actions -->
                <div class="border-t border-slate-100 pt-2 mt-1">
                    <!-- Compact Creator Info -->
                     <div class="flex items-center gap-2 mb-2 cursor-pointer hover:bg-slate-50 rounded-lg p-0.5 -ml-0.5 transition-colors w-fit" id="library-creator-${res.id}">
                        <img src="${teacherImg}" class="w-5 h-5 rounded-full object-cover border border-slate-200">
                        <span class="text-[10px] text-slate-500">Por <span class="font-bold text-slate-700 hover:text-indigo-600 truncate max-w-[150px] inline-block align-bottom">${res.autor}</span></span>
                    </div>
                    
                    <!-- Action Bar (Compact Grid/Flex) -->
                    <div class="flex items-center gap-2 justify-between">
                        <!-- Status/Type instead of Price -->
                        <span class="text-xs font-bold text-emerald-600 tracking-tight leading-none">
                            <i class="fa-solid fa-check-circle"></i> Adquirido
                        </span>
                        
                        <div class="flex items-center gap-1">
                             <!-- Share -->
                            <button class="share-btn w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Compartir">
                                <i class="fa-solid fa-share-nodes text-xs"></i>
                            </button>
                            
                            <!-- Download/Access (Styled like 'Add' button but adapted) -->
                            <a href="${res.url}" target="_blank" 
                               class="download-btn h-7 px-3 flex-shrink-0 rounded-lg ${primaryBtnColor} text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:brightness-110 transition-all shadow-sm active:scale-95 whitespace-nowrap no-underline">
                                <i class="fa-solid ${btnIcon}"></i> <span>${isUrl ? 'Acceder' : 'Descargar'}</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners (Prevent propagation to card click)
        const favBtn = card.querySelector('.fav-btn');
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(res.id);
        };

        const shareBtn = card.querySelector('.share-btn');
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            handleShare(res);
        };

        const creatorDiv = card.querySelector(`#library-creator-${res.id}`);
        if (creatorDiv) {
            creatorDiv.onclick = (e) => {
                e.stopPropagation();
                if (creatorId) {
                    // Since we are in /panel/biblioteca.html and perfile is /panel/perfil.html
                    window.location.href = `perfil.html?uid=${creatorId}`;
                }
            };
        }

        // El botón de descarga también debe evitar abrir el modal si ya es un enlace directo
        const downloadBtn = card.querySelector('.download-btn');
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
        };

        ui.container.appendChild(card);
    });
}

function showEmptyState() {
    ui.container.innerHTML = '';
    ui.container.classList.add('hidden');
    ui.emptyMsg.classList.remove('hidden');
}

// Helper para compartir (reutilizado simplificado)
async function handleShare(product) {
    const url = window.location.href.split('?')[0]; // URL base de la biblioteca no sirve mucho para compartir producto específico si no es público, mejor link al catálogo si es posible
    // Pero como es biblioteca privada, compartiremos el link público del producto si existiera, o solo texto.
    // Asumiremos que queremos compartir el 'dato' de que tengo este material.

    // Mejor estrategia: Compartir link al catálogo para que otros lo compren
    const catalogUrl = `${window.location.origin}/catalogo.html?id=${product.id}`;
    const text = `¡Mira este material genial! "${product.titulo}" por ${product.autor}.`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: product.titulo,
                text: text,
                url: catalogUrl
            });
        } else {
            await navigator.clipboard.writeText(`${text} ${catalogUrl}`);
            alert("¡Enlace copiado! Compártelo con tus colegas.");
        }
    } catch (err) {
        console.error("Error compartiendo:", err);
    }
}

// Helper Visual (copiado de catalogo.js)
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
    if (['zip', 'rar'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-zipper"></i>', label: 'ZIP', class: 'bg-amber-500 text-white' };
    if (['ppt', 'pptx'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-powerpoint"></i>', label: 'PPT', class: 'bg-orange-500 text-white' };
    if (['doc', 'docx'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-file-word"></i>', label: 'DOC', class: 'bg-blue-600 text-white' };
    if (['jpg', 'jpeg', 'png', 'webp'].some(ext => t.includes(ext))) return { icon: '<i class="fa-solid fa-image"></i>', label: 'IMG', class: 'bg-purple-600 text-white' };

    // Default PDF
    return { icon: '<i class="fa-solid fa-file-pdf"></i>', label: 'PDF', class: 'bg-red-500 text-white' };
}

// 6. Setup Event Listeners
function setupEventListeners() {
    // Filtros (Todos, Archivos, Online, Favoritos)
    ui.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            ui.filterBtns.forEach(b => {
                b.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
                b.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
            });
            btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
            btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900');

            currentFilter = btn.getAttribute('data-type');
            renderLibrary();
        });
    });

    // Búsqueda
    ui.searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim();
        renderLibrary();
    });

    // Ordenamiento
    ui.sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderLibrary();
    });

    // Modal Events
    setupModalEvents();
}

/**
 * ============================================================================
 * LÓGICA DEL MODAL DE PRODUCTO (Portado de Catálogo)
 * ============================================================================
 */
const modal = {
    container: document.getElementById('productModal'),
    backdrop: document.getElementById('productModalBackdrop'),
    panel: document.getElementById('productModalPanel'),
    btnClose: document.getElementById('btnCloseModal'),
    galleryContainer: document.getElementById('modalGalleryContainer'),
    levelTag: document.getElementById('modalLevelTag'),
    title: document.getElementById('modalTitle'),
    teacherImg: document.getElementById('modalTeacherImg'),
    teacherName: document.getElementById('modalTeacherName'),
    desc: document.getElementById('modalDesc'),
    type: document.getElementById('modalType'),
    format: document.getElementById('modalFormat'),
    btnShare: document.getElementById('modalBtnShare'),
    btnPrimary: document.getElementById('modalBtnPrimary')
};

let currentProduct = null;
let carouselState = {
    currentIndex: 0,
    totalSlides: 0,
    touchStartX: 0,
    touchEndX: 0,
    track: null,
    indicators: null,
    counter: null
};

function setupModalEvents() {
    if (!modal.container) return;

    modal.btnClose.addEventListener('click', closeProductModal);
    modal.backdrop.addEventListener('click', closeProductModal);

    // Share Button
    modal.btnShare.addEventListener('click', () => {
        if (currentProduct) handleShare(currentProduct);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.container.classList.contains('hidden')) {
            closeProductModal();
        }
    });

    // Keyboard Nav for Carousel
    document.addEventListener('keydown', (e) => {
        if (!modal.container.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') navigateCarousel(-1);
            if (e.key === 'ArrowRight') navigateCarousel(1);
        }
    });

    // Creator Redirection in Modal
    const redirectCreator = () => {
        if (currentProduct && currentProduct.creador_uid) {
            window.location.href = `perfil.html?uid=${currentProduct.creador_uid}`;
        }
    };

    if (modal.teacherName) {
        modal.teacherName.classList.add('cursor-pointer', 'hover:text-indigo-600', 'transition-colors');
        modal.teacherName.onclick = redirectCreator;
    }

    if (modal.teacherImg) {
        modal.teacherImg.classList.add('cursor-pointer', 'hover:opacity-80', 'transition-opacity');
        modal.teacherImg.onclick = redirectCreator;
    }
}

function openProductModal(product) {
    currentProduct = product;

    // 1. Render Gallery (Carousel)
    renderCarousel(product);

    // 2. Populate Info
    modal.levelTag.innerText = (product.levels && product.levels.length > 0) ? product.levels.join(", ") : "Nivel General";
    modal.title.innerText = product.titulo;
    modal.teacherName.innerText = product.autor;
    modal.teacherImg.src = product.creador_foto || 'https://i.imgur.com/O1F7GGy.png';
    // Descripción: Si no existe en el objeto (porque loadLibrary carga básico), intentamos mostrar algo genérico o lo que haya
    // Nota: Como 'allResources' ya carga 'autor' y 'creador_foto', pero tal vez no 'descripcion' completa si venía de orders... 
    // De hecho en loadLibrary SÍ estamos cargando 'productData' completo si existe, pero no lo estabamos guardando en 'resourceData'.
    // VOY A ASUMIR que necesito agregar 'descripcion' a resourceData en loadLibrary. 
    // Por ahora mostraré lo que haya o placeholder.
    modal.desc.innerText = product.descripcion || "Sin descripción detallada disponible.";

    modal.type.innerText = product.tipo_entrega === 'url' ? 'Plataforma Online' : 'Archivo Descargable';
    modal.format.innerText = product.formato ? product.formato.toUpperCase() : '-';

    // 3. Setup Primary Button (Download/Access)
    const isUrl = product.tipo_entrega === 'url';
    modal.btnPrimary.href = product.url; // Ya es seguro porque product.url viene de la DB

    const btnIconInfo = isUrl ? '<i class="fa-solid fa-arrow-up-right-from-square"></i>' : '<i class="fa-solid fa-download"></i> class="group-hover:animate-bounce"';
    const btnText = isUrl ? 'Acceder al Material' : 'Descargar Material';

    modal.btnPrimary.className = `h-14 px-6 font-bold rounded-2xl text-white shadow-lg active:scale-95 flex items-center justify-center gap-2 group no-underline transition-all ${isUrl ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200' : 'bg-slate-900 hover:bg-indigo-600 shadow-indigo-200'}`;
    modal.btnPrimary.innerHTML = `<span>${btnText}</span> ${isUrl ? '<i class="fa-solid fa-arrow-up-right-from-square"></i>' : '<i class="fa-solid fa-download group-hover:animate-bounce"></i>'}`;

    // 4. Mostrar Modal
    modal.container.classList.remove('hidden');
    // Animación
    setTimeout(() => {
        modal.backdrop.classList.remove('opacity-0');
        modal.panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modal.panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);

    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    currentProduct = null;

    // Animación Salida
    modal.backdrop.classList.add('opacity-0');
    modal.panel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    modal.panel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');

    setTimeout(() => {
        modal.container.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

// === Carousel Logic ===

function renderCarousel(product) {
    if (!modal.galleryContainer) return;
    modal.galleryContainer.innerHTML = '';

    // Intentamos obtener imágenes: 'imagenes_preview' no lo estabamos guardando en loadLibrary, 
    // solo guardabamos 'imagen' (la primera).
    // CORRECCIÓN NECESARIA: Debemos guardar el array de imágenes en loadLibrary.
    // Asumiré que resourceData tiene 'imagenes_preview' o usaremos [product.imagen] como fallback.
    const images = (product.imagenes_preview && product.imagenes_preview.length)
        ? product.imagenes_preview
        : (product.imagen ? [product.imagen] : []);

    const meta = getFileMeta(product.formato, product.tipo_entrega);

    if (images.length === 0) {
        modal.galleryContainer.innerHTML = `
            <div class="w-full h-64 md:h-full bg-slate-50 flex items-center justify-center text-slate-300 text-5xl min-h-[300px]">
                ${meta.icon}
            </div>
        `;
    } else {
        const carouselHTML = `
            <div class="carousel-container relative w-full h-full bg-slate-900 overflow-hidden">
                <div class="carousel-track flex h-full transition-transform duration-300" id="carouselTrack">
                    ${images.map((src, index) => `
                        <div class="carousel-slide min-w-full h-full flex items-center justify-center bg-slate-100">
                             <img src="${src}" class="max-w-full max-h-full object-contain" loading="${index === 0 ? 'eager' : 'lazy'}">
                        </div>
                    `).join('')}
                </div>
                
                ${images.length > 1 ? `
                    <button class="carousel-nav prev absolute top-1/2 left-4 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-white transition-all shadow-md z-10" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="carousel-nav next absolute top-1/2 right-4 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-white transition-all shadow-md z-10" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    
                    <div class="carousel-indicators absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        ${images.map((_, index) => `
                            <button class="carousel-indicator w-2 h-2 rounded-full bg-white/50 hover:bg-white transition-all ${index === 0 ? 'bg-white w-6' : ''}" data-index="${index}"></button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        modal.galleryContainer.innerHTML = carouselHTML;

        if (images.length > 1) {
            initCarousel(images.length);
        }
    }
}

function initCarousel(totalSlides) {
    carouselState.currentIndex = 0;
    carouselState.totalSlides = totalSlides;
    carouselState.track = document.getElementById('carouselTrack');
    carouselState.indicators = document.querySelectorAll('.carousel-indicator');

    const prevBtn = modal.galleryContainer.querySelector('.carousel-nav.prev');
    const nextBtn = modal.galleryContainer.querySelector('.carousel-nav.next');

    if (prevBtn) prevBtn.addEventListener('click', () => navigateCarousel(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateCarousel(1));

    carouselState.indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => goToSlide(index));
    });
}

function navigateCarousel(direction) {
    if (!carouselState.track) return;
    carouselState.currentIndex += direction;

    if (carouselState.currentIndex < 0) {
        carouselState.currentIndex = carouselState.totalSlides - 1;
    } else if (carouselState.currentIndex >= carouselState.totalSlides) {
        carouselState.currentIndex = 0;
    }
    updateCarouselView();
}

function goToSlide(index) {
    if (!carouselState.track) return;
    carouselState.currentIndex = index;
    updateCarouselView();
}

function updateCarouselView() {
    const offset = -carouselState.currentIndex * 100;
    carouselState.track.style.transform = `translateX(${offset}%)`;

    // Indicators
    carouselState.indicators.forEach((indicator, index) => {
        if (index === carouselState.currentIndex) {
            indicator.classList.add('bg-white', 'w-6');
            indicator.classList.remove('bg-white/50');
        } else {
            indicator.classList.remove('bg-white', 'w-6');
            indicator.classList.add('bg-white/50');
        }
    });
}
