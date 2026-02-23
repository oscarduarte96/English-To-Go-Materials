/**
 * ============================================================================
 * PORTAFOLIO.JS - Gestión de Materiales del Creador
 * ============================================================================
 * Responsabilidad:
 * 1. Cargar estadísticas de ventas del creador.
 * 2. Mostrar inventario de productos del creador.
 * 3. Acciones: Editar, Eliminar, Compartir.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, deleteDoc, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { auth, db } from "../../assets/js/firebase-app.js";

// ============================================================================
// ESTADO Y UI
// ============================================================================
let currentUser = null;
let allProducts = [];
let salesHistory = []; // NEW: Store sales transactions
let productToDelete = null;
let currentView = 'list'; // 'list' | 'grid'

const ui = {
    // Stats
    statIncome: document.getElementById('statIncome'),
    statSales: document.getElementById('statSales'),
    statProducts: document.getElementById('statProducts'),
    // States
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    inventoryGrid: document.getElementById('inventoryGrid'),
    // Sales Report
    salesList: document.getElementById('salesList'),
    // Toggles
    btnViewList: document.getElementById('btnViewList'),
    btnViewGrid: document.getElementById('btnViewGrid'),
    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteModalBackdrop: document.getElementById('deleteModalBackdrop'),
    deleteModalPanel: document.getElementById('deleteModalPanel'),
    deleteModalMsg: document.getElementById('deleteModalMsg'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),
    // Product Modal
    modal: {
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
        skill: document.getElementById('modalSkill'),
        grammar: document.getElementById('modalGrammar'),
        price: document.getElementById('modalPrice'),
        btnShare: document.getElementById('modalBtnShare')
    }
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
function init() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadPortfolioData();
            setupEventListeners();
        } else {
            // Guard.js ya debería redirigir, pero por seguridad:
            window.location.href = '../auth/login.html';
        }
    });
}

// ============================================================================
// CARGA DE DATOS
// ============================================================================
async function loadPortfolioData() {
    // Flag to track partial failures
    let productsLoaded = false;

    try {
        console.log("Cargando portafolio para:", currentUser.uid);

        // 1. Fetch Products (Should always work - Public Rule)
        try {
            const productsQuery = query(
                collection(db, "products"),
                where("creador_uid", "==", currentUser.uid)
            );
            const productsSnapshot = await getDocs(productsQuery);
            console.log(`Encontrados ${productsSnapshot.size} productos.`);

            allProducts = [];
            productsSnapshot.forEach(docSnap => {
                allProducts.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Ordenamiento Cliente
            allProducts.sort((a, b) => {
                const dateA = a.fecha_creacion ? (a.fecha_creacion.toMillis ? a.fecha_creacion.toMillis() : new Date(a.fecha_creacion).getTime()) : 0;
                const dateB = b.fecha_creacion ? (b.fecha_creacion.toMillis ? b.fecha_creacion.toMillis() : new Date(b.fecha_creacion).getTime()) : 0;
                return dateB - dateA;
            });

            productsLoaded = true;
        } catch (prodErr) {
            console.error("Error loading products:", prodErr);
            throw { source: 'products', error: prodErr }; // Re-throw to main catcher
        }

        // 2. Fetch Orders (Might fail if Rules/Auth are strict)
        let totalSales = 0;
        let totalIncome = 0;
        const salesByProduct = {}; // NEW: Track sales per product

        try {
            const ordersQuery = query(
                collection(db, "orders"),
                where("author_ids", "array-contains", currentUser.uid)
            );
            const ordersSnapshot = await getDocs(ordersQuery);

            ordersSnapshot.forEach(orderDoc => {
                const orderData = orderDoc.data();

                // Filtrar solo órdenes completadas
                if (orderData.status !== 'completed') return;


                // Lógica de Ventas / Ingresos
                if (orderData.items && Array.isArray(orderData.items)) {
                    // Determinar factor de descuento global de la orden
                    let discountFactor = 1;

                    if (orderData.coupon_discount_percent === 100) {
                        discountFactor = 0;
                    } else if (orderData.coupon_discount_percent > 0) {
                        discountFactor = 1 - (orderData.coupon_discount_percent / 100);
                    } else if (orderData.original_total > 0 && orderData.final_total < orderData.original_total) {
                        // Descuento fijo prorrateado (fallback)
                        discountFactor = orderData.final_total / orderData.original_total;
                    }

                    orderData.items.forEach(item => {
                        // Verificar que el item pertenece a este autor
                        const itemAutorId = String(item.autor_id);
                        const currentUid = String(currentUser.uid);

                        if (itemAutorId === currentUid) {
                            totalSales++;
                            const precioBase = Number(item.precio) || 0;

                            // Calcular Ingreso Real
                            const ingresoReal = Math.floor(precioBase * discountFactor); // Round down for safety
                            totalIncome += ingresoReal;

                            // NEW: Increment product specific sales count
                            if (item.id) {
                                salesByProduct[item.id] = (salesByProduct[item.id] || 0) + 1;
                            }

                            // NEW: Add to Sales History
                            salesHistory.push({
                                id: orderDoc.id,
                                fecha: orderData.created_at,
                                producto: item.titulo,
                                cliente: orderData.user_name || "Cliente",
                                email: orderData.user_email || "No email",
                                ingreso: ingresoReal,
                                precioOriginal: precioBase,
                                es_canje: (discountFactor === 0),
                                cupon: orderData.coupon_code || null
                            });
                        }
                    });
                }
            });

            // Ordenar Historial de Ventas (Más reciente primero)
            salesHistory.sort((a, b) => {
                const dateA = a.fecha ? (a.fecha.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime()) : 0;
                const dateB = b.fecha ? (b.fecha.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime()) : 0;
                return dateB - dateA;
            });

            // NEW: Render Sales History
            renderSalesHistory();

            // NEW: Enrich products with sales count
            allProducts = allProducts.map(p => ({
                ...p,
                ventas: salesByProduct[p.id] || 0
            }));

        } catch (orderErr) {
            console.error("Error loading orders (Permissions?):", orderErr);
            // Don't crash the whole page, just show 0 sales
            ui.statIncome.parentElement.title = `Error ventas: ${orderErr.code}`; // Debug hint in UI
        }

        // 3. Update Stats UI
        ui.statIncome.textContent = window.utils?.formatCurrency
            ? window.utils.formatCurrency(totalIncome)
            : `$ ${totalIncome.toLocaleString('es-CO')} COP`;

        ui.statSales.textContent = totalSales;
        ui.statProducts.textContent = allProducts.length;

        // 4. Render Inventory
        renderInventory();

    } catch (error) {
        console.error("Error Fatal en Portafolio:", error);

        const errObj = error.source ? error.error : error;
        const isIndexError = errObj.message && errObj.message.includes("index");
        const msg = isIndexError
            ? "Falta un índice en Firestore (Products)."
            : `Error en ${error.source || 'General'}: ${errObj.code || 'Desconocido'} - ${errObj.message}`;

        ui.loadingState.innerHTML = `
            <div class="flex flex-col items-center max-w-md text-center">
                <i class="fa-solid fa-triangle-exclamation text-4xl text-danger mb-4"></i>
                <p class="text-danger font-bold text-lg mb-2">Error Crítico</p>
                <p class="text-slate-600 mb-4 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs text-left w-full break-all">
                    ${msg}
                </p>
            </div>
        `;
    }
}

// ============================================================================
// RENDERIZADO DEL INVENTARIO
// ============================================================================
function renderInventory() {
    ui.loadingState.classList.add('hidden');
    ui.inventoryGrid.innerHTML = '';

    if (allProducts.length === 0) {
        ui.emptyState.classList.remove('hidden');
        ui.inventoryGrid.classList.add('hidden');
        return;
    }

    ui.emptyState.classList.add('hidden');
    ui.inventoryGrid.classList.remove('hidden');

    // Update Grid Container Classes based on View
    if (currentView === 'list') {
        ui.inventoryGrid.className = "flex flex-col gap-3";
    } else {
        ui.inventoryGrid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    }

    // Update Button States
    if (ui.btnViewList && ui.btnViewGrid) {
        if (currentView === 'list') {
            ui.btnViewList.className = "p-2 w-10 h-10 rounded-lg bg-white shadow-sm text-primary transition-all";
            ui.btnViewGrid.className = "p-2 w-10 h-10 rounded-lg text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-800 transition-all";
        } else {
            ui.btnViewList.className = "p-2 w-10 h-10 rounded-lg text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-800 transition-all";
            ui.btnViewGrid.className = "p-2 w-10 h-10 rounded-lg bg-white shadow-sm text-primary transition-all";
        }
    }

    allProducts.forEach(product => {
        const card = document.createElement('div');

        // Date Formatting
        let dateStr = "Fecha desconocida";
        if (product.fecha_creacion) {
            dateStr = window.utils?.formatDate ? window.utils.formatDate(product.fecha_creacion) : new Date(product.fecha_creacion).toLocaleDateString();
        }

        const imgSrc = (product.imagenes_preview && product.imagenes_preview.length > 0)
            ? product.imagenes_preview[0]
            : (product.imagen || 'https://placehold.co/400x250/e2e8f0/94a3b8?text=Sin+Imagen');

        const priceText = product.es_gratis
            ? '<span class="text-emerald-600 font-black">GRATIS</span>'
            : (window.utils?.formatCurrency ? window.utils.formatCurrency(product.precio) : `$ ${product.precio}`);

        const statusBadge = product.activo !== false
            ? '<span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Activo</span>'
            : '<span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Inactivo</span>';

        // Sales Counter HTML
        const salesHtml = `
            <span class="text-xs text-slate-500 font-medium flex items-center gap-1" title="Ventas totales">
                <i class="fa-solid fa-shopping-cart text-slate-400"></i> ${product.ventas || 0}
            </span>
        `;

        if (currentView === 'list') {
            // LIST VIEW
            card.className = "bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center justify-between gap-4 transition-all hover:shadow-md hover:border-slate-200 cursor-pointer group";
            card.innerHTML = `
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <img src="${imgSrc}" alt="" class="w-16 h-16 rounded-lg object-cover bg-slate-100 flex-shrink-0">
                    <div class="min-w-0">
                        <h3 class="font-bold text-slate-800 text-sm md:text-base truncate group-hover:text-indigo-600 transition-colors" title="${product.titulo}">${product.titulo}</h3>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            ${statusBadge}
                            <span class="text-xs text-slate-400 font-medium border-r border-slate-200 pr-2 mr-1">${priceText}</span>
                            
                            <!-- Sales Counter -->
                            ${salesHtml}

                            <span class="hidden sm:inline-block text-[10px] text-slate-400 border-l border-slate-200 pl-2 ml-1">
                                <i class="fa-regular fa-calendar mr-1"></i> ${dateStr}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button class="share-btn w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all z-10 relative"
                            data-id="${product.id}" data-title="${product.titulo}" title="Compartir">
                        <i class="fa-solid fa-share-nodes"></i>
                    </button>
                    <button class="delete-btn w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-danger hover:bg-red-50 transition-all z-10 relative"
                            data-id="${product.id}" data-title="${product.titulo}" title="Eliminar">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        } else {
            // GRID VIEW
            card.className = "bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full group hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer";
            card.innerHTML = `
                <div class="relative h-40 overflow-hidden bg-slate-100">
                    <img src="${imgSrc}" alt="${product.titulo}" class="w-full h-full object-cover">
                    <div class="absolute top-3 right-3 flex flex-col items-end gap-1">
                        ${statusBadge}
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                        <span class="text-[10px] font-medium text-white/90">
                            <i class="fa-regular fa-calendar mr-1"></i> ${dateStr}
                        </span>
                    </div>
                </div>
                <div class="p-5 flex-grow flex flex-col">
                    <h3 class="font-bold text-slate-800 text-base leading-snug mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors" title="${product.titulo}">
                        ${product.titulo}
                    </h3>
                    
                    <div class="flex items-center justify-between mb-4">
                        <p class="text-sm text-slate-500">${priceText}</p>
                        ${salesHtml}
                    </div>

                    <div class="mt-auto flex items-center gap-2 pt-3 border-t border-slate-100">
                        <!-- Share Button -->
                        <button class="share-btn flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-slate-50 text-slate-500 font-bold hover:text-cyan-600 hover:bg-cyan-50 transition-all border border-slate-100 z-10 relative"
                                data-id="${product.id}" data-title="${product.titulo}" title="Compartir">
                            <i class="fa-solid fa-share-nodes"></i> Compartir
                        </button>
                        <!-- Delete Button -->
                        <button class="delete-btn w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-danger hover:bg-red-50 transition-all border border-slate-100 z-10 relative"
                                data-id="${product.id}" data-title="${product.titulo}" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // Event Listeners
        card.onclick = () => openProductModal(product);

        card.querySelector('.share-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleShare({ id: product.id, title: product.titulo });
        });

        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openDeleteModal({ id: product.id, title: product.titulo });
        });

        ui.inventoryGrid.appendChild(card);
    });
}

// ============================================================================
// RENDERIZADO DEL HISTORIAL DE VENTAS
// ============================================================================
function renderSalesHistory() {
    if (!ui.salesList) return;
    ui.salesList.innerHTML = '';

    if (salesHistory.length === 0) {
        ui.salesList.innerHTML = `
            <div class="p-8 text-center bg-slate-50 flex flex-col items-center justify-center">
                <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <i class="fa-solid fa-receipt text-slate-400 text-xl"></i>
                </div>
                <p class="text-slate-500 font-medium text-sm">Aún no tienes ventas registradas.</p>
            </div>
        `;
        return;
    }

    salesHistory.forEach(sale => {
        // Formatos
        let dateStr = "Fecha desconocida";
        if (sale.fecha) {
            dateStr = window.utils?.formatDate ? window.utils.formatDate(sale.fecha) : new Date(sale.fecha).toLocaleDateString();
        }

        const ingresoTxt = window.utils?.formatCurrency ? window.utils.formatCurrency(sale.ingreso) : `$ ${sale.ingreso}`;
        const originalTxt = window.utils?.formatCurrency ? window.utils.formatCurrency(sale.precioOriginal) : `$ ${sale.precioOriginal}`;

        // Badge Logic
        let statusBadge = '';
        let rowClass = '';

        if (sale.es_canje) {
            statusBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    <i class="fa-solid fa-ticket"></i> Canje (Cupón)
                </span>
            `;
            rowClass = 'bg-slate-50/50'; // Slightly dim for coupons
        } else if (sale.ingreso < sale.precioOriginal) {
            statusBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                    <i class="fa-solid fa-percent"></i> Desc. Parcial
                </span>
            `;
        } else {
            statusBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <i class="fa-solid fa-check"></i> Venta Pagada
                </span>
            `;
        }

        // Row HTML (Responsive: Grid on Desktop, Stack on Mobile)
        const row = document.createElement('div');
        row.className = `group hover:bg-slate-50 transition-colors p-4 ${rowClass}`;

        row.innerHTML = `
            <!-- Mobile View (Stack) -->
            <div class="md:hidden flex flex-col gap-3">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-xs text-slate-400 font-bold uppercase mb-1">${dateStr}</p>
                        <h4 class="font-bold text-slate-800 text-sm leading-tight">${sale.producto}</h4>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-slate-900 ${sale.es_canje ? 'text-purple-600' : 'text-emerald-600'}">${ingresoTxt}</p>
                        ${sale.ingreso < sale.precioOriginal ? `<p class="text-xs text-slate-400 line-through">${originalTxt}</p>` : ''}
                    </div>
                </div>
                
                <div class="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px]">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <span class="text-slate-600 font-medium truncate max-w-[120px]" title="${sale.email}">${sale.cliente}</span>
                    </div>
                    <div>${statusBadge}</div>
                </div>
            </div>

            <!-- Desktop View (Grid) -->
            <div class="hidden md:grid grid-cols-12 gap-4 items-center text-sm">
                <!-- Date -->
                <div class="col-span-3 text-slate-500 font-medium flex items-center gap-2">
                    <i class="fa-regular fa-calendar text-slate-300"></i> ${dateStr}
                </div>
                
                <!-- Product -->
                <div class="col-span-4 font-bold text-slate-700 truncate" title="${sale.producto}">
                    ${sale.producto}
                </div>
                
                <!-- Client -->
                <div class="col-span-3 flex flex-col justify-center">
                    <span class="font-bold text-slate-700 truncate">${sale.cliente}</span>
                    <span class="text-xs text-slate-400 truncate max-w-[150px]" title="${sale.email}">${sale.email}</span>
                </div>
                
                <!-- Income & Badge -->
                <div class="col-span-2 text-right flex flex-col items-end gap-1">
                    <span class="font-black ${sale.es_canje ? 'text-purple-600' : 'text-slate-900'}">${ingresoTxt}</span>
                    ${sale.ingreso < sale.precioOriginal ? `<span class="text-[10px] text-slate-400 line-through">${originalTxt}</span>` : ''}
                    <div class="scale-90 origin-right">${statusBadge}</div>
                </div>
            </div>
        `;

        ui.salesList.appendChild(row);
    });
}
// ============================================================================
// ACCIONES: COMPARTIR, ELIMINAR
// ============================================================================

async function handleShare(data) {
    const catalogUrl = `${window.location.origin}/catalogo.html?id=${data.id}`;
    const text = `¡Mira este material! "${data.title}" en English To Go Materials.`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: data.title,
                text: text,
                url: catalogUrl
            });
        } else {
            await navigator.clipboard.writeText(`${text} ${catalogUrl}`);
            alert("¡Enlace copiado al portapapeles!");
        }
    } catch (err) {
        console.error("Error compartiendo:", err);
    }
}

function openDeleteModal(data) {
    productToDelete = data;
    ui.deleteModalMsg.innerHTML = `¿Estás seguro de que deseas eliminar <strong>"${data.title}"</strong>? Esta acción no se puede deshacer.`;

    ui.deleteModal.classList.remove('hidden');
    // Animation
    setTimeout(() => {
        ui.deleteModalBackdrop.classList.remove('opacity-0');
        ui.deleteModalPanel.classList.remove('opacity-0', 'scale-95');
        ui.deleteModalPanel.classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closeDeleteModal() {
    productToDelete = null;
    ui.deleteModalBackdrop.classList.add('opacity-0');
    ui.deleteModalPanel.classList.add('opacity-0', 'scale-95');
    ui.deleteModalPanel.classList.remove('opacity-100', 'scale-100');
    setTimeout(() => {
        ui.deleteModal.classList.add('hidden');
    }, 200);
}

async function confirmDelete() {
    if (!productToDelete || !productToDelete.id) return;

    ui.btnConfirmDelete.disabled = true;
    ui.btnConfirmDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await deleteDoc(doc(db, "products", productToDelete.id));

        // Refresh inventory
        allProducts = allProducts.filter(p => p.id !== productToDelete.id);
        ui.statProducts.textContent = allProducts.length;
        renderInventory();

        closeDeleteModal();
    } catch (error) {
        console.error("Error eliminando producto:", error);
        alert("Hubo un error al eliminar el material. Intenta nuevamente.");
    } finally {
        ui.btnConfirmDelete.disabled = false;
        ui.btnConfirmDelete.innerHTML = 'Sí, Eliminar';
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    ui.btnCancelDelete.addEventListener('click', closeDeleteModal);
    ui.deleteModalBackdrop.addEventListener('click', closeDeleteModal);
    ui.btnConfirmDelete.addEventListener('click', confirmDelete);

    // Modal Events
    if (ui.modal.btnClose) ui.modal.btnClose.addEventListener('click', closeProductModal);
    if (ui.modal.backdrop) ui.modal.backdrop.addEventListener('click', closeProductModal);
    if (ui.modal.btnShare) {
        ui.modal.btnShare.addEventListener('click', () => {
            if (activeProduct) handleShare({ id: activeProduct.id, title: activeProduct.titulo });
        });
    }

    // View Toggles
    if (ui.btnViewList) {
        ui.btnViewList.addEventListener('click', () => {
            currentView = 'list';
            renderInventory();
        });
    }
    if (ui.btnViewGrid) {
        ui.btnViewGrid.addEventListener('click', () => {
            currentView = 'grid';
            renderInventory();
        });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!ui.deleteModal.classList.contains('hidden')) closeDeleteModal();
            if (!ui.modal.container.classList.contains('hidden')) closeProductModal();
        }
    });
}

// ============================================================================
// INICIAR
// ============================================================================
// ============================================================================
// MODAL & CAROUSEL LOGIC
// ============================================================================
let activeProduct = null;

function openProductModal(p) {
    activeProduct = p;
    const m = ui.modal;

    // 1. Render Gallery (Multi-image CAROUSEL)
    if (m.galleryContainer) {
        m.galleryContainer.innerHTML = ''; // Clear previous

        const images = (p.imagenes_preview && p.imagenes_preview.length)
            ? p.imagenes_preview
            : (p.imagen ? [p.imagen] : []); // Fallback to classic single image field

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
    m.teacherImg.src = p.creador_foto || '../assets/img/logo.png';
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

    // Mostrar (Transiciones CSS manuales)
    m.container.classList.remove('hidden');

    // Animación Entrada
    setTimeout(() => {
        m.backdrop.classList.remove('opacity-0');
        m.panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        m.panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);

    document.body.style.overflow = 'hidden'; // Lock scroll
}

function closeProductModal() {
    const m = ui.modal;
    activeProduct = null;

    // Animación Salida
    m.backdrop.classList.add('opacity-0');
    m.panel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    m.panel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');

    setTimeout(() => {
        m.container.classList.add('hidden');
        document.body.style.overflow = ''; // Unlock scroll
    }, 300);
}

// ----------------------------------------------------------------------------
// CAROUSEL LOGIC
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// HELPER: GET FILE META
// ----------------------------------------------------------------------------
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

// ============================================================================
// INICIAR
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
