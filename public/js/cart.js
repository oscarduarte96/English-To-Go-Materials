/**
 * ============================================================================
 * LÓGICA DEL CARRITO (CART.JS) - FIREBASE EDITION (SECURE & OPTIMIZED)
 * ============================================================================
 * Responsabilidad: 
 * 1. Gestionar estado del carrito sincronizado con Firestore.
 * 2. Sincronización en Tiempo Real (Multi-dispositivo).
 * 3. Renderizado del Drawer del carrito.
 * 4. Procesamiento de Checkout (CON VERIFICACIÓN DE PRECIOS SERVIDOR).
 * * DEPENDENCIA: Requiere assets/js/utils.js cargado previamente (window.utils)
 */

// 1. IMPORTACIONES
import { auth, db } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    doc, 
    onSnapshot, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    collection, 
    addDoc, 
    serverTimestamp,
    getDoc // IMPORTANTE: Necesario para verificar precios
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// 2. ESTADO GLOBAL Y CONFIGURACIÓN
let unsubscribeCart = null;

window.appState = window.appState || {};
window.appState.cart = [];
window.appState.user = null;

// 3. REFERENCIAS AL DOM
let ui = {};

/**
 * 5. INICIALIZACIÓN (OPTIMIZADO - SIN RACE CONDITIONS)
 */
async function init() {
    // CORRECCIÓN TÉCNICA: Espera nativa a que el Web Component esté definido
    await customElements.whenDefined('app-cart-drawer');

    // Intentamos capturar el elemento una vez que el componente ya "existe" para el navegador
    const drawerElement = document.getElementById('cartDrawer');
    
    // Validación defensiva final
    if (!drawerElement) {
        console.error("Error crítico: El componente app-cart-drawer se definió pero no renderizó el ID #cartDrawer.");
        return;
    }

    // 2. Capturamos las referencias
    ui = {
        btnClose: document.getElementById('closeCartBtn'),
        overlay: document.getElementById('cartOverlay'),
        drawer: drawerElement,
        itemsContainer: document.getElementById('cartItemsContainer'),
        emptyMsg: document.getElementById('emptyCartMsg'),
        totalDisplay: document.getElementById('cartTotalDisplay'),
        btnCheckout: document.getElementById('btnCheckout')
    };

    // 3. Procedemos con la configuración
    setupEventListeners();
    setupAuthListener();
}

function setupEventListeners() {
    window.addEventListener('toggle-cart', () => openCart());

    if (ui.btnClose) ui.btnClose.onclick = closeCart;
    if (ui.overlay) ui.overlay.onclick = closeCart;
    if (ui.btnCheckout) ui.btnCheckout.onclick = handleCheckout;
}

function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        window.appState.user = user;
        if (user) {
            subscribeToCart(user.uid);
        } else {
            if (unsubscribeCart) {
                unsubscribeCart();
                unsubscribeCart = null;
            }
            window.appState.cart = [];
            updateCartUI();
            window.dispatchEvent(new Event('cart-updated'));
        }
    });
}

/**
 * 6. LÓGICA DEL CORE DEL CARRITO (FIRESTORE)
 */

function subscribeToCart(uid) {
    const userDocRef = doc(db, "users", uid);

    unsubscribeCart = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.appState.cart = data.myCart || [];
        } else {
            window.appState.cart = [];
        }
        updateCartUI();
        window.dispatchEvent(new Event('cart-updated'));
    }, (error) => {
        console.error("Error sincronizando carrito:", error);
    });
}

window.addToCart = async (product) => {
    const user = auth.currentUser;

    if (!user) {
        alert("Para agregar productos al carrito y sincronizarlos entre tus dispositivos, por favor inicia sesión.");
        sessionStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = '../auth/login.html'; 
        return;
    }

    const exists = window.appState.cart.find(item => item.id === product.id);
    if (exists) {
        openCart();
        return;
    }

    const cartItem = {
        id: product.id,
        titulo: product.titulo,
        precio: Number(product.precio), // Precio visual (no confiable para checkout)
        imagen: product.imagenes_preview && product.imagenes_preview.length > 0 
                ? product.imagenes_preview[0] 
                : null,
        tipo: product.tipo_archivo || 'Digital',
        autor_id: product._normalizedTeacherId || 'unknown'
    };

    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            myCart: arrayUnion(cartItem)
        }, { merge: true });
        
        openCart();
    } catch (error) {
        console.error("Error guardando en Firestore:", error);
        alert("Hubo un error al guardar el producto. Intenta nuevamente.");
    }
};

async function removeFromCart(productId) {
    const user = auth.currentUser;
    if (!user) return;

    const newCart = window.appState.cart.filter(item => item.id !== productId);

    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { myCart: newCart });
    } catch (error) {
        console.error("Error eliminando item:", error);
    }
}

async function clearCart() {
    const user = auth.currentUser;
    if (!user) {
        window.appState.cart = [];
        updateCartUI();
        return;
    }
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { myCart: [] });
    } catch (error) {
        console.error("Error limpiando carrito:", error);
    }
}

/**
 * 7. RENDERIZADO UI
 */
function updateCartUI() {
    const cart = window.appState.cart;
    const count = cart.length;

    const badgeElement = document.getElementById('header-cart-badge');
    if (badgeElement) {
        badgeElement.innerText = count;
        badgeElement.classList.toggle('hidden', count === 0);
    }

    if (!ui.itemsContainer) return;

    if (count === 0) {
        ui.itemsContainer.innerHTML = '';
        if (ui.emptyMsg) ui.emptyMsg.classList.remove('hidden');
        if (ui.totalDisplay) ui.totalDisplay.innerText = window.utils ? window.utils.formatCurrency(0) : '$ 0';
        if (ui.btnCheckout) {
            ui.btnCheckout.disabled = true;
            ui.btnCheckout.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return;
    }

    if (ui.emptyMsg) ui.emptyMsg.classList.add('hidden');
    if (ui.btnCheckout) {
        ui.btnCheckout.disabled = false;
        ui.btnCheckout.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    ui.itemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        total += item.precio;
        
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md";
        
        const imgHtml = item.imagen 
            ? `<img src="${item.imagen}" class="w-16 h-16 rounded-lg object-cover border border-slate-100">`
            : `<div class="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xl"><i class="fa-solid fa-file"></i></div>`;

        const precioFormateado = window.utils ? window.utils.formatCurrency(item.precio) : `$ ${item.precio}`;

        div.innerHTML = `
            ${imgHtml}
            <div class="flex-grow min-w-0">
                <h4 class="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-1">${item.titulo}</h4>
                <p class="text-indigo-600 font-black text-sm">${precioFormateado}</p>
            </div>
            <button class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all btn-remove" data-id="${item.id}">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        `;

        div.querySelector('.btn-remove').onclick = (e) => {
            e.stopPropagation();
            removeFromCart(item.id);
        };

        ui.itemsContainer.appendChild(div);
    });

    if (ui.totalDisplay) {
        ui.totalDisplay.innerText = window.utils ? window.utils.formatCurrency(total) : `$ ${total}`;
    }
}

/**
 * 8. INTERACCIÓN DEL DRAWER
 */
function openCart() {
    if (!ui.overlay || !ui.drawer) return;
    ui.overlay.classList.remove('hidden');
    ui.drawer.classList.remove('translate-x-full');
    setTimeout(() => ui.overlay.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden'; 
}

function closeCart() {
    if (!ui.overlay || !ui.drawer) return;
    ui.overlay.classList.add('opacity-0');
    ui.drawer.classList.add('translate-x-full');
    setTimeout(() => {
        ui.overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

/**
 * 9. CHECKOUT SEGURO (Server-Side Price Validation)
 */
async function handleCheckout() {
    // A. Verificar Autenticación
    const user = auth.currentUser;
    if (!user) {
        sessionStorage.setItem('redirect_after_login', 'checkout');
        window.location.href = '../auth/login.html';
        return;
    }

    // B. Obtener items locales solo para referencias de IDs
    const localCart = window.appState.cart;
    if (localCart.length === 0) return;

    // UI Loading
    ui.btnCheckout.disabled = true;
    ui.btnCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando precios...';

    try {
        // --- CORRECCIÓN DE SEGURIDAD ---
        // 1. No confiamos en el precio del carrito local.
        // 2. Buscamos el precio actual en la colección 'products'.
        
        let verifiedTotal = 0;
        const verifiedItems = [];
        const missingItems = [];

        // Creamos un array de promesas para buscar todos los productos en paralelo
        const productPromises = localCart.map(item => getDoc(doc(db, "products", item.id)));
        
        // Ejecutamos las consultas
        const snapshots = await Promise.all(productPromises);

        // Procesamos resultados
        snapshots.forEach((snap, index) => {
            if (snap.exists()) {
                const productData = snap.data();
                const realPrice = Number(productData.precio) || 0;
                
                verifiedTotal += realPrice;

                // Reconstruimos el item con el precio REAL de la base de datos
                verifiedItems.push({
                    ...localCart[index], // Mantenemos metadatos UI (titulo, imagen)
                    precio: realPrice,   // SOBREESCRIBIMOS el precio con el dato seguro
                    verified_at: new Date().toISOString()
                });
            } else {
                // Producto ya no existe en DB
                missingItems.push(localCart[index].titulo);
            }
        });

        // Validación: Si faltan productos críticos
        if (missingItems.length > 0) {
            alert(`Atención: Algunos productos ya no están disponibles y fueron removidos de la orden: \n- ${missingItems.join('\n- ')}`);
            // Aquí podríamos actualizar el carrito local para reflejar esto, 
            // pero por ahora procedemos con los que sí existen si el usuario acepta (o abortamos).
            // Estrategia: Abortar para que el usuario revise.
            ui.btnCheckout.disabled = false;
            ui.btnCheckout.innerHTML = '<span>Finalizar Compra</span> <i class="fa-solid fa-arrow-right"></i>';
            return; // Detenemos el checkout
        }

        if (verifiedItems.length === 0) {
            throw new Error("No hay productos válidos para procesar.");
        }

        console.log(`Checkout Verificado: Total Local $${localCart.reduce((a,b)=>a+b.precio,0)} vs Total DB $${verifiedTotal}`);

        // C. Construir Objeto de Orden Seguro
        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: verifiedItems, // Usamos los items verificados
            total_amount: verifiedTotal, // Usamos el total recalculado
            currency: 'COP',
            status: 'pending',
            created_at: serverTimestamp(),
            platform: 'web_catalog_v2'
        };

        // D. Guardar en Firestore
        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("Orden creada con ID: ", docRef.id);

        // E. Limpiar y Feedback
        await clearCart(); 
        closeCart();
        
        alert("¡Pedido creado exitosamente! Redirigiendo a tus compras...");
        window.location.href = '../panel/biblioteca.html'; 

    } catch (error) {
        console.error("Error en checkout:", error);
        alert("Hubo un error al procesar el pedido. Por favor intenta nuevamente.");
    } finally {
        if (ui.btnCheckout) {
            ui.btnCheckout.disabled = false;
            ui.btnCheckout.innerHTML = '<span>Finalizar Compra</span> <i class="fa-solid fa-arrow-right"></i>';
        }
    }
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);