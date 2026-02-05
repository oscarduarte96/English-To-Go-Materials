/**
 * ============================================================================
 * PRODUCT MODAL MODULE (Shared)
 * ============================================================================
 * Handles the logic for the Product Details Modal, including:
 * 1. Validating/Injecting HTML into the DOM.
 * 2. Opening/Closing logic with animations.
 * 3. Carousel logic.
 * 4. Interactions (Add to Cart, Share).
 */

const ProductModal = {
    elements: null,
    carouselState: {
        currentIndex: 0,
        totalSlides: 0,
        touchStartX: 0,
        touchEndX: 0,
        track: null,
        indicators: null,
        counter: null
    },
    currentProduct: null,

    /**
     * Initialize the modal.
     * Injects HTML if not present, and sets up event listeners.
     */
    init: function () {
        if (!document.getElementById('productModal')) {
            this.injectHTML();
        }
        this.cacheElements();
        this.setupEvents();
    },

    /**
     * Injects the Modal HTML structure into the end of the body.
     */
    injectHTML: function () {
        const modalHTML = `
        <div id="productModal" class="fixed inset-0 z-[100] hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity opacity-0" id="productModalBackdrop"></div>
    
            <div class="fixed inset-0 z-10 overflow-y-auto">
                <div class="flex min-h-full items-center justify-center p-0 text-center sm:p-4">
    
                    <!-- Modal Panel (Mobile Optimized) -->
                    <div class="relative transform overflow-hidden bg-white text-left shadow-2xl transition-all w-full sm:max-w-4xl opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95 flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl mt-auto sm:mt-0" id="productModalPanel">
    
                        <!-- Botón Cerrar Flotante -->
                        <button id="btnCloseModal" class="absolute top-4 right-4 z-40 bg-white/80 backdrop-blur-md h-10 w-10 flex items-center justify-center rounded-full text-slate-500 hover:text-red-500 transition-colors shadow-lg border border-white/50">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
    
                        <div class="flex flex-col md:flex-row h-full overflow-hidden">
    
                            <!-- 1. Columna Visual (Galería) -->
                            <div class="w-full md:w-1/2 bg-slate-100 relative group flex-shrink-0 h-[35vh] md:h-auto overflow-hidden" id="modalGalleryContainer">
                                <!-- JS inyectará las imágenes aquí -->
                            </div>
    
                            <!-- 2. Columna Info (Scrollable en móvil) -->
                            <div class="w-full md:w-1/2 flex flex-col bg-white min-h-0 flex-1">
    
                                <!-- Header Info (Scrollable Content) -->
                                <div class="flex-grow overflow-y-auto custom-scroll p-6 md:p-8">
                                    <div class="flex items-center gap-2 mb-3">
                                        <span id="modalLevelTag" class="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">B1 Intermediate</span>
                                    </div>
    
                                    <h2 id="modalTitle" class="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-4 text-balance">
                                        Título del Material
                                    </h2>
    
                                    <div class="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                                        <img id="modalTeacherImg" src="" class="w-10 h-10 rounded-full bg-slate-200 object-cover">
                                        <div>
                                            <p class="text-xs text-slate-400 font-bold uppercase">Creado por</p>
                                            <p id="modalTeacherName" class="text-sm font-bold text-slate-700">Nombre Profesor</p>
                                        </div>
                                    </div>
    
                                    <div class="prose prose-slate prose-sm text-slate-500 mb-6">
                                        <p id="modalDesc">Descripción completa del material...</p>
                                    </div>
    
                                    <!-- Metadata Grid -->
                                    <div class="grid grid-cols-2 gap-4 text-xs">
                                        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <span class="block text-slate-400 font-bold mb-1 uppercase tracking-wider">Habilidad</span>
                                            <span id="modalSkill" class="font-bold text-slate-700">-</span>
                                        </div>
                                        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <span class="block text-slate-400 font-bold mb-1 uppercase tracking-wider">Gramática</span>
                                            <span id="modalGrammar" class="font-bold text-slate-700">-</span>
                                        </div>
                                    </div>
                                </div>
    
                                <!-- Footer Sticky Actions (Fixed on mobile) -->
                                <div class="flex-shrink-0 p-4 md:p-6 border-t border-slate-100 bg-white/95 backdrop-blur z-20 shadow-[0_-5px_30px_rgba(0,0,0,0.05)]">
                                    <div class="flex items-center justify-between mb-4">
                                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Precio</span>
                                        <span id="modalPrice" class="text-3xl font-black text-slate-900 tracking-tight">$0</span>
                                    </div>
    
                                    <div class="grid grid-cols-[auto_1fr] gap-3">
                                        <button id="modalBtnShare" class="w-14 h-14 flex items-center justify-center rounded-2xl border-2 border-slate-100 text-slate-400 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all">
                                            <i class="fa-solid fa-share-nodes text-xl"></i>
                                        </button>
    
                                        <button id="modalBtnAdd" class="h-14 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2 group">
                                            <span>Agregar al Carrito</span>
                                            <i class="fa-solid fa-cart-plus group-hover:animate-bounce"></i>
                                        </button>
                                    </div>
                                </div>
    
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    cacheElements: function () {
        this.elements = {
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
            btnAdd: document.getElementById('modalBtnAdd'),
            btnShare: document.getElementById('modalBtnShare')
        };
    },

    setupEvents: function () {
        const els = this.elements;
        if (!els.container) return;

        // Create wrapper for potential creator redirection
        const goToCreatorProfile = () => {
            if (this.currentProduct && this.currentProduct.creador_uid) {
                const origin = window.location.origin;
                let path = '/panel/perfil.html';
                window.location.href = `${origin}${path}?uid=${this.currentProduct.creador_uid}`;
            }
        };

        if (els.teacherName) {
            els.teacherName.classList.add('cursor-pointer', 'hover:text-indigo-600', 'transition-colors');
            els.teacherName.onclick = goToCreatorProfile;
        }

        if (els.teacherImg) {
            els.teacherImg.classList.add('cursor-pointer', 'hover:opacity-80', 'transition-opacity');
            els.teacherImg.onclick = goToCreatorProfile;
        }

        const close = () => this.close();
        els.btnClose.onclick = close;
        els.backdrop.onclick = close;

        // Add to Cart Logic
        els.btnAdd.onclick = () => {
            if (this.currentProduct) {
                if (typeof window.addToCart === 'function') {
                    if (this.currentProduct.es_gratis) {
                        this.handleFreeDownload(this.currentProduct, els.btnAdd);
                    } else {
                        window.addToCart(this.currentProduct);
                    }
                } else {
                    console.warn("window.addToCart is not defined.");
                }
            }
        };

        // Share Logic
        els.btnShare.onclick = () => {
            if (this.currentProduct) {
                this.handleShare(this.currentProduct);
            }
        };

        // ESC Key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !els.container.classList.contains('hidden')) {
                close();
            }
        });
    },

    /**
     * Opens the modal with the given product data.
     */
    open: function (product) {
        this.currentProduct = product;
        const els = this.elements;

        // 1. Render Gallery
        this.renderGallery(product);

        // 2. Populate Info
        els.levelTag.innerText = product.levels ? product.levels.join(", ") : "Nivel General";
        els.title.innerText = product.titulo;
        els.teacherName.innerText = product.creador_nombre || product.autor || "English To Go";
        els.teacherImg.src = product.creador_foto || 'https://i.imgur.com/O1F7GGy.png';
        els.desc.innerText = product.descripcion || "Sin descripción detallada.";
        els.skill.innerText = product.skills ? product.skills.join(", ") : "Varias";
        els.grammar.innerText = product.grammar ? product.grammar.join(", ") : "General";

        const priceFormatted = product.es_gratis ? "GRATIS" : (window.utils?.formatCurrency ? window.utils.formatCurrency(product.precio) : `$${product.precio}`);
        els.price.innerText = priceFormatted;

        // Style Price & Button
        // Style Price & Button
        const purchasedIds = window.appState?.purchasedProductIds;
        if (purchasedIds && purchasedIds.has(product.id)) {
            // YA COMPRADO (Prioridad)
            els.price.classList.add('text-indigo-600');
            els.price.classList.remove('text-emerald-600', 'text-slate-900');
            this.updateButtonToPurchased(els.btnAdd);
        } else if (product.es_gratis) {
            els.price.classList.add('text-emerald-600');
            els.price.classList.remove('text-slate-900');
            this.updateButtonToDownload(els.btnAdd);
        } else {
            els.price.classList.add('text-slate-900');
            els.price.classList.remove('text-emerald-600');
            this.updateButtonToCart(els.btnAdd, product.id);
        }

        // 3. Show Modal
        els.container.classList.remove('hidden');

        // Animation
        setTimeout(() => {
            els.backdrop.classList.remove('opacity-0');
            els.panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
            els.panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
        }, 10);

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    },

    close: function () {
        const els = this.elements;
        this.currentProduct = null;

        els.backdrop.classList.add('opacity-0');
        els.panel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        els.panel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');

        setTimeout(() => {
            els.container.classList.add('hidden');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }, 300);
    },

    /**
     * Carousel Logic
     */
    renderGallery: function (product) {
        const gallery = this.elements.galleryContainer;
        gallery.innerHTML = '';

        // Normalize images
        // Supports both array of strings or single string
        let images = [];
        if (Array.isArray(product.imagenes_preview) && product.imagenes_preview.length > 0) {
            images = product.imagenes_preview;
        } else if (product.imagen) {
            images = [product.imagen];
        } else if (product._img) { // Compatibility with some existing objects
            images = [product._img];
        }

        let icon = '<i class="fa-solid fa-file-pdf"></i>';
        if (product.tipo_archivo?.toLowerCase().includes('powerpoint')) icon = '<i class="fa-solid fa-file-powerpoint"></i>';

        if (images.length === 0) {
            gallery.innerHTML = `
                <div class="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-5xl min-h-[300px]">
                    ${icon}
                </div>
            `;
            return;
        }

        const carouselHTML = `
            <div class="carousel-container">
                <div class="carousel-track" id="carouselTrack">
                    ${images.map((src, index) => `
                        <div class="carousel-slide">
                            <img src="${src}" loading="${index === 0 ? 'eager' : 'lazy'}" alt="${product.titulo}">
                        </div>
                    `).join('')}
                </div>
                
                ${images.length > 1 ? `
                    <button class="carousel-nav prev" id="carouselPrev"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="carousel-nav next" id="carouselNext"><i class="fa-solid fa-chevron-right"></i></button>
                    <div class="carousel-indicators" id="carouselIndicators">
                        ${images.map((_, index) => `<button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></button>`).join('')}
                    </div>
                    <div class="carousel-counter"><span id="carouselCounter">1</span> / ${images.length}</div>
                ` : ''}
            </div>
        `;

        gallery.innerHTML = carouselHTML;

        if (images.length > 1) {
            this.initCarouselLogic(images.length);
        }
    },

    initCarouselLogic: function (totalSlides) {
        const s = this.carouselState;
        s.currentIndex = 0;
        s.totalSlides = totalSlides;
        s.track = document.getElementById('carouselTrack');
        s.indicators = document.querySelectorAll('.carousel-indicator');
        s.counter = document.getElementById('carouselCounter');

        document.getElementById('carouselPrev').onclick = (e) => { e.stopPropagation(); this.navigateCarousel(-1); };
        document.getElementById('carouselNext').onclick = (e) => { e.stopPropagation(); this.navigateCarousel(1); };

        s.indicators.forEach((ind, i) => {
            ind.onclick = (e) => { e.stopPropagation(); this.goToSlide(i); };
        });

        // Keyboard arrows
        const keyHandler = (e) => {
            if (!this.elements.container.classList.contains('hidden') && s.totalSlides > 1) {
                if (e.key === 'ArrowLeft') this.navigateCarousel(-1);
                if (e.key === 'ArrowRight') this.navigateCarousel(1);
            }
        };
    },

    navigateCarousel: function (dir) {
        const s = this.carouselState;
        if (!s.track) return;
        s.currentIndex += dir;
        if (s.currentIndex < 0) s.currentIndex = s.totalSlides - 1;
        if (s.currentIndex >= s.totalSlides) s.currentIndex = 0;
        this.updateCarouselView();
    },

    goToSlide: function (index) {
        this.carouselState.currentIndex = index;
        this.updateCarouselView();
    },

    updateCarouselView: function () {
        const s = this.carouselState;
        if (!s.track) return;
        const offset = -s.currentIndex * 100;
        s.track.style.transform = `translateX(${offset}%)`;

        s.indicators.forEach((ind, i) => ind.classList.toggle('active', i === s.currentIndex));
        if (s.counter) s.counter.innerText = s.currentIndex + 1;
    },

    /**
     * Button States
     */
    updateButtonToDownload: function (btn) {
        btn.className = "h-14 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-2 group w-full";
        btn.innerHTML = `<span>Descargar Ahora</span> <i class="fa-solid fa-cloud-arrow-down group-hover:animate-bounce"></i>`;
    },

    updateButtonToPurchased: function (btn) {
        btn.className = "h-14 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center justify-center gap-2 group w-full";
        btn.innerHTML = `<span>Adquirido • Ver en Biblioteca</span> <i class="fa-solid fa-check-circle"></i>`;

        btn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'panel/biblioteca.html';
        };
    },

    updateButtonToCart: function (btn, detailId) {
        // Reset to default style
        btn.className = "h-14 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2 group w-full";

        // 1. Check if Purchased
        const purchasedIds = window.appState?.purchasedProductIds;
        if (purchasedIds && purchasedIds.has(detailId)) {
            btn.innerHTML = `<span>Adquirido • Ver en Biblioteca</span> <i class="fa-solid fa-check-circle"></i>`;
            btn.className = "h-14 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center justify-center gap-2 group w-full";

            // Override click behavior
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'panel/biblioteca.html';
            };
            return;
        }

        // 2. Check if in Cart
        const inCart = window.appState?.cart?.some(i => i.id === detailId);

        if (inCart) {
            btn.innerHTML = `<span>En el carrito</span> <i class="fa-solid fa-check"></i>`;
            btn.classList.add('bg-indigo-600');
        } else {
            btn.innerHTML = `<span>Agregar al Carrito</span> <i class="fa-solid fa-cart-plus group-hover:animate-bounce"></i>`;
        }
    },

    /**
     * Helpers
     */
    handleShare: function (product) {
        const url = window.location.origin + "/catalogo.html?id=" + product.id;

        if (navigator.share) {
            navigator.share({
                title: product.titulo,
                text: "¡Mira este material en English To Go!",
                url: url
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(url);
            if (window.utils?.showToast) {
                window.utils.showToast("¡Enlace copiado al portapapeles!");
            } else {
                alert("Enlace copiado al portapapeles!");
            }
        }
    },

    handleFreeDownload: function (product, btnElement) {
        // Logic for free download
        if (window.addToCart) {
            window.open(product.url_archivo, '_blank');
        }
    }
};

export default ProductModal;
