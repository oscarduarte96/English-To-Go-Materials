import { auth, db } from './firebase-app.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * COMPONENTE: App Header
 * Versión 2.1 - Mejora UX Móvil (Cierre automático de menús)
 * Emite: 'toggle-sidebar', 'toggle-cart', 'toggle-search'
 * Escucha: 'cart-updated'
 */
class AppHeader extends HTMLElement {
    constructor() {
        super();
        this.user = null;
    }

    connectedCallback() {
        this.render();
        this.setupAuthListener();
        this.setupEventListeners();
        this.setupGlobalListeners();

        // 1. Lógica del Sidebar (Opcional por página)
        if (this.hasAttribute('no-sidebar')) {
            const sidebarBtn = this.querySelector('#header-sidebar-toggle');
            if (sidebarBtn) {
                sidebarBtn.style.display = 'none';
            }
        }
        // 2. Lógica del Carrito (Blindada para Móvil)
        if (this.hasAttribute('no-cart')) {
            const cartBtn = this.querySelector('#header-cart-btn');
            if (cartBtn) {
                cartBtn.style.setProperty('display', 'none', 'important');
            }
        }
    }

    render() {
        // Rutas relativas
        const isRoot = !window.location.pathname.includes('/panel/') && !window.location.pathname.includes('/auth/');
        const basePath = isRoot ? '.' : '..';

        // Detectar si estamos en catálogo
        const isCatalog = window.location.pathname.includes('catalogo.html');

        // Visibilidad del buscador
        const hasSearch = this.hasAttribute('with-search');
        // En catálogo: siempre visible. En otras páginas: solo móvil.
        const searchClass = hasSearch ? (isCatalog ? '' : 'lg:hidden') : 'hidden';

        // Detectar modo checkout
        const isCheckout = this.hasAttribute('checkout-mode');

        this.innerHTML = `
        <nav class="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center fixed top-0 w-full z-50 h-[74px]">
            
            <div class="flex items-center gap-4">
                ${!isCheckout ? `
                <button id="header-sidebar-toggle" class="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none">
                    <i class="fa-solid fa-bars text-xl"></i>
                </button>
                ` : ''}

                <a href="${basePath}/index.html" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src="${basePath}/assets/img/logo.png" alt="Logo" class="w-10 h-10 rounded-full border border-slate-200 shadow-sm">
                    <span class="font-bold text-slate-800 tracking-tight text-xl hidden sm:block">
                        English To Go <span class="text-indigo-600">Materials</span>
                    </span>
                </a>
            </div>
        
            <div class="flex items-center gap-2 sm:gap-4 relative" id="header-user-container">
                
                ${!isCheckout && !isCatalog ? `
                <!-- CTA Catálogo (Mobile - Compact Circular) -->
                <a href="${basePath}/catalogo.html" 
                   id="header-catalog-btn-mobile"
                   class="lg:hidden flex items-center justify-center w-10 h-10 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 rounded-full transition-all active:scale-95 shadow-sm"
                   title="Explorar Catálogo">
                    <i class="fa-solid fa-layer-group text-sm"></i>
                </a>
                
                <!-- CTA Catálogo (Desktop - Full Button) -->
                <a href="${basePath}/catalogo.html" 
                   class="hidden lg:flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 px-5 py-2 rounded-full font-bold text-sm transition-all active:scale-95 shadow-sm hover:shadow-md">
                    <i class="fa-solid fa-layer-group"></i>
                    Explorar Catálogo
                </a>
                ` : ''}

                ${!isCheckout ? `
                <button id="header-search-trigger" class="${searchClass} p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none">
                    <i class="fa-solid fa-magnifying-glass text-xl"></i>
                </button>
                
                <button id="header-cart-btn" class="p-2 rounded-full hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors relative group">
                    <i class="fa-solid fa-cart-shopping text-xl"></i>
                    <span id="header-cart-badge" class="hidden absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white transform transition-transform group-hover:scale-110">0</span>
                </button>
                ` : ''}

                <div id="auth-loading" class="text-slate-400 text-sm font-medium animate-pulse">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                </div>

                <!-- Login Button (Mobile - Compact Circular) -->
                <a id="btn-login-mobile" href="${basePath}/auth/login.html" class="hidden lg:hidden items-center justify-center w-10 h-10 bg-slate-100 text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-full transition-all active:scale-95 shadow-sm"
                   title="Iniciar Sesión">
                    <i class="fa-solid fa-user text-sm"></i>
                </a>
                
                <!-- Login Button (Desktop - Full Button) -->
                <a id="btn-login" href="${basePath}/auth/login.html" class="hidden lg:flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-full transition-all border border-indigo-200">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar Sesión
                </a>

                <div id="user-logged-area" class="hidden relative">
                    <button id="user-menu-btn" class="flex items-center gap-3 focus:outline-none group pl-2 border-l border-slate-200 ml-2">
                        <div class="text-right hidden sm:block">
                            <p id="user-name-display" class="text-xs font-bold text-slate-700">Usuario</p>
                            <p id="user-role-display" class="text-[10px] text-slate-500 font-medium">Estudiante</p>
                        </div>
                        <img id="user-avatar-display" src="https://i.imgur.com/O1F7GGy.png" class="w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover:border-indigo-100 transition-all object-cover">
                        <i id="user-menu-caret" class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-300"></i>
                    </button>
        
                    <div id="user-dropdown" class="hidden absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                        <div class="px-4 py-2 border-b border-slate-50 mb-1">
                            <p class="text-xs text-slate-400 uppercase font-bold">Navegación</p> 
                        </div>

                        <a href="${basePath}/panel/dashboard.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors"> 
                            <i class="fa-solid fa-house w-6"></i> Panel Principal
                        </a>

                        <a href="${basePath}/catalogo.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
                            <i class="fa-solid fa-magnifying-glass w-6"></i> Explorar Catálogo
                        </a>
            
                        <a href="${basePath}/panel/biblioteca.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
                            <i class="fa-solid fa-folder-open w-6"></i> Mi Biblioteca
                        </a>

                        <a href="${basePath}/panel/perfil.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors">
                            <i class="fa-solid fa-user w-6"></i> Mi Perfil
                        </a>
                        
                        <div id="menu-teacher-section" class="hidden">
                            <div class="border-t border-slate-50 my-1"></div>
                            <p class="px-4 py-2 text-xs text-slate-400 uppercase font-bold mt-1">Panel Creador</p> 
                            
                            <a href="${basePath}/panel/publicacion.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 font-medium transition-colors">
                                <i class="fa-solid fa-cloud-arrow-up w-6"></i> Subir Material
                            </a>
                            <a href="${basePath}/panel/portafolio.html" class="block px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 font-medium transition-colors"> 
                                <i class="fa-solid fa-chart-line w-6"></i> Gestión de Materiales
                            </a>
                        </div>
            
                        <div class="border-t border-slate-100 my-1"></div>
                        
                        <button id="btn-logout-action" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 font-bold transition-colors">
                            <i class="fa-solid fa-power-off w-6"></i> Cerrar Sesión 
                        </button>
                    </div>
                </div>

            </div>
        </nav>
        `;
    }

    setupAuthListener() {
        const els = {
            loading: this.querySelector('#auth-loading'),
            loginBtn: this.querySelector('#btn-login'),
            loginBtnMobile: this.querySelector('#btn-login-mobile'),
            loggedArea: this.querySelector('#user-logged-area'),
            userName: this.querySelector('#user-name-display'),
            userAvatar: this.querySelector('#user-avatar-display'),
            userRole: this.querySelector('#user-role-display'),
            teacherSection: this.querySelector('#menu-teacher-section')
        };

        onAuthStateChanged(auth, async (user) => {
            els.loading.classList.add('hidden');

            if (user) {
                this.user = user;
                // Hide both login buttons (mobile & desktop)
                els.loginBtn.classList.add('hidden');
                els.loginBtn.classList.remove('lg:flex');
                if (els.loginBtnMobile) {
                    els.loginBtnMobile.classList.add('hidden');
                    els.loginBtnMobile.classList.remove('flex');
                }
                els.loggedArea.classList.remove('hidden');

                els.userName.innerText = user.displayName?.split(' ')[0] || "Usuario";
                if (user.photoURL) els.userAvatar.src = user.photoURL;

                try {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.roles && data.roles.teacher) {
                            els.userRole.innerText = "CREADOR";
                            els.userRole.className = "text-[10px] text-indigo-600 font-bold uppercase tracking-wider";
                            els.teacherSection.classList.remove('hidden');
                        }
                    }
                } catch (e) {
                    console.error("Error obteniendo rol:", e);
                }

            } else {
                this.user = null;
                els.loggedArea.classList.add('hidden');
                // Show both login buttons with their responsive visibility
                els.loginBtn.classList.add('hidden');
                els.loginBtn.classList.add('lg:flex');
                if (els.loginBtnMobile) {
                    els.loginBtnMobile.classList.remove('hidden');
                    els.loginBtnMobile.classList.add('flex', 'lg:hidden');
                }
            }
        });
    }

    setupEventListeners() {
        // 1. Toggle Sidebar
        const sidebarBtn = this.querySelector('#header-sidebar-toggle');
        if (sidebarBtn) {
            sidebarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('toggle-sidebar', { bubbles: true }));
            });
        }

        // 1.5 Toggle Buscador
        const searchBtn = this.querySelector('#header-search-trigger');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('toggle-search', { bubbles: true }));
            });
        }

        // 2. Toggle Carrito
        const cartBtn = this.querySelector('#header-cart-btn');
        if (cartBtn) {
            cartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('toggle-cart', { bubbles: true }));
            });
        }

        // 3. Dropdown Usuario (SOLUCIÓN MEJORADA)
        const menuBtn = this.querySelector('#user-menu-btn');
        const dropdown = this.querySelector('#user-dropdown');
        const caret = this.querySelector('#user-menu-caret');

        if (menuBtn && dropdown) {
            // A. Click en el botón (Toggle)
            menuBtn.addEventListener('click', (e) => {
                // Detenemos la propagación para que no llegue al document listener inmediatamente
                e.stopPropagation();

                const isHidden = dropdown.classList.toggle('hidden');
                if (caret) {
                    caret.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });

            // B. Click en cualquier lugar del documento (Cerrar)
            document.addEventListener('click', (e) => {
                // Si el menú NO está oculto...
                if (!dropdown.classList.contains('hidden')) {
                    // Y el click NO fue en el botón Y NO fue dentro del propio menú...
                    if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
                        // Cerramos
                        dropdown.classList.add('hidden');
                        if (caret) caret.style.transform = 'rotate(0deg)';
                    }
                }
            });
        }

        // 4. Logout
        const logoutBtn = this.querySelector('#btn-logout-action');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.reload();
            });
        }
    }

    setupGlobalListeners() {
        // Escuchar cambios en el carrito
        window.addEventListener('cart-updated', (event) => {
            const badge = this.querySelector('#header-cart-badge');
            if (!badge) return;

            let count = 0;
            if (window.appState && window.appState.cart) {
                count = window.appState.cart.length;
            } else if (typeof event.detail === 'number') {
                count = event.detail;
            }

            badge.innerText = count;

            if (count > 0) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.classList.remove('scale-100');
                badge.classList.add('scale-125');
                setTimeout(() => {
                    badge.classList.remove('scale-125');
                    badge.classList.add('scale-100');
                }, 200);
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
            }
        });
    }
}

/**
 * COMPONENTE: App Cart Drawer (NUEVO)
 * Encapsula la estructura visual del carrito para ser reutilizable
 * Contiene los IDs que cart.js necesita: cartDrawer, cartOverlay, closeCartBtn, etc.
 */
class AppCartDrawer extends HTMLElement {
    connectedCallback() {
        // Renderizamos directamente en el Light DOM para que cart.js encuentre los IDs
        this.innerHTML = `
            <div id="cartOverlay" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] hidden transition-opacity opacity-0"></div>
            
            <div id="cartDrawer" class="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white z-[200] transform translate-x-full transition-transform duration-300 shadow-2xl flex flex-col font-sans">
                
                <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <h2 class="text-lg font-black text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-basket-shopping text-indigo-600"></i> Tu Carrito
                    </h2>
                    <button id="closeCartBtn" class="text-slate-400 hover:text-slate-800 transition-colors p-2 rounded-full hover:bg-slate-100">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex-grow overflow-y-auto p-5 custom-scroll bg-slate-50/50 relative">
                    
                    <div id="emptyCartMsg" class="hidden flex flex-col items-center justify-center h-full text-center text-slate-400">
                        <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i class="fa-solid fa-cart-arrow-down text-3xl text-slate-300"></i>
                        </div>
                        <p class="font-bold text-sm">Tu carrito está vacío</p>
                        <p class="text-xs mt-1">¡Explora el catálogo y añade materiales!</p>
                    </div>

                    <div id="cartItemsContainer" class="space-y-3">
                        </div>
                </div>

                <div class="p-5 border-t border-slate-100 bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-20">
                    
                    <!-- Sección Cupón -->
                    <div id="couponSection" class="mb-4 pb-4 border-b border-slate-100">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="fa-solid fa-ticket text-indigo-500 text-sm"></i>
                            <span class="text-xs font-bold text-slate-600">¿Tienes un cupón?</span>
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="couponInput" placeholder="Ej: ESTUDIANTE2024" 
                                   class="flex-grow px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all uppercase font-medium text-slate-700 placeholder:normal-case placeholder:font-normal">
                            <button id="btnApplyCoupon" class="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-bold rounded-lg hover:bg-indigo-100 transition-all border border-indigo-200 whitespace-nowrap">
                                Aplicar
                            </button>
                        </div>
                        <!-- Estado del cupón (dinámico) -->
                        <div id="couponStatus" class="hidden mt-2 text-xs font-medium p-2 rounded-lg"></div>
                    </div>
                    
                    <!-- Resumen de Descuento (visible solo si hay cupón) -->
                    <div id="discountSummary" class="hidden mb-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">Subtotal</span>
                            <span id="subtotalDisplay" class="font-medium text-slate-700">$0</span>
                        </div>
                        <div class="flex justify-between items-center text-sm mt-1">
                            <span class="text-emerald-600 font-medium flex items-center gap-1">
                                <i class="fa-solid fa-tag"></i> Descuento
                            </span>
                            <span id="discountDisplay" class="font-bold text-emerald-600">-$0</span>
                        </div>
                    </div>

                    <div class="flex justify-between items-end mb-4">
                        <span class="text-sm font-medium text-slate-500">Total a pagar</span>
                        <span id="cartTotalDisplay" class="text-2xl font-black text-slate-900 tracking-tight">$0</span>
                    </div>
                    
                    <!-- Botón Checkout (se transforma según el total) -->
                    <button id="btnCheckout" class="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2">
                        <span>Finalizar Compra</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    
                    <!-- Botón alternativo para costo cero (oculto por defecto) -->
                    <button id="btnRedeemAccess" class="hidden w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-2">
                        <i class="fa-solid fa-gift"></i>
                        <span>Canjear Acceso Ahora</span>
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * COMPONENTE: App Footer
 */
class AppFooter extends HTMLElement {
    connectedCallback() {
        const year = new Date().getFullYear();

        // Rutas relativas para links del footer
        const isRoot = !window.location.pathname.includes('/panel/') && !window.location.pathname.includes('/auth/');
        const basePath = isRoot ? '.' : '..';

        this.innerHTML = `
        <footer class="bg-white border-t border-slate-200 mt-auto pt-16 pb-8">
            <div class="max-w-7xl mx-auto px-6">
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    
                    <!-- Columna Brand -->
                    <div class="lg:col-span-1">
                        <a href="${basePath}/index.html" class="flex items-center gap-3 mb-6">
                            <img src="${basePath}/assets/img/logo.png" alt="Logo" class="w-10 h-10 rounded-full border border-slate-200 opacity-80 hover:opacity-100 transition-all">
                            <span class="font-bold text-slate-800 tracking-tight text-lg">
                                English To Go
                            </span>
                        </a>
                        <p class="text-slate-500 text-sm leading-relaxed mb-6">
                            Infraestructura académica digital para la enseñanza del inglés. Conectando excelencia pedagógica con tecnología global.
                        </p>
                        <div class="flex gap-4">
                            <a href="#" class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><i class="fa-brands fa-linkedin-in text-xs"></i></a>
                            <a href="#" class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><i class="fa-brands fa-twitter text-xs"></i></a>
                            <a href="#" class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><i class="fa-brands fa-instagram text-xs"></i></a>
                        </div>
                    </div>

                    <!-- Columna Empresa -->
                    <div>
                        <h4 class="font-bold text-slate-900 mb-6 text-sm uppercase tracking-wider">Empresa</h4>
                        <ul class="space-y-4 text-sm text-slate-500 font-medium">
                            <li><a href="${basePath}/nosotros.html" class="hover:text-indigo-600 transition-colors">Quiénes Somos</a></li>
                            <li><a href="${basePath}/nosotros.html" class="hover:text-indigo-600 transition-colors">Misión y Visión</a></li>
                            <li><a href="${basePath}/contacto.html" class="hover:text-indigo-600 transition-colors">Trabaja con Nosotros</a></li>
                        </ul>
                    </div>

                    <!-- Columna Soporte -->
                    <div>
                        <h4 class="font-bold text-slate-900 mb-6 text-sm uppercase tracking-wider">Ayuda & Soporte</h4>
                        <ul class="space-y-4 text-sm text-slate-500 font-medium">
                            <li><a href="${basePath}/contacto.html" class="hover:text-indigo-600 transition-colors">Centro de Ayuda</a></li>
                            <li><a href="${basePath}/contacto.html" class="hover:text-indigo-600 transition-colors">Reportar un Problema</a></li>
                            <li><a href="${basePath}/contacto.html" class="hover:text-indigo-600 transition-colors">Estado del Servicio</a></li>
                        </ul>
                    </div>

                    <!-- Columna Legal -->
                    <div>
                        <h4 class="font-bold text-slate-900 mb-6 text-sm uppercase tracking-wider">Legal</h4>
                        <ul class="space-y-4 text-sm text-slate-500 font-medium">
                            <li><a href="#" class="hover:text-indigo-600 transition-colors">Términos de Uso</a></li>
                            <li><a href="#" class="hover:text-indigo-600 transition-colors">Privacidad de Datos</a></li>
                            <li><a href="#" class="hover:text-indigo-600 transition-colors">Cookies</a></li>
                        </ul>
                    </div>

                </div>

                <div class="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p class="text-slate-400 text-xs font-medium">
                        &copy; ${year} English To Go Group. Todos los derechos reservados.
                    </p>
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistemas Operativos</span>
                    </div>
                </div>

            </div>
        </footer>
        `;
    }
}

// Registro de componentes
customElements.define('app-header', AppHeader);
customElements.define('app-footer', AppFooter);
customElements.define('app-cart-drawer', AppCartDrawer);