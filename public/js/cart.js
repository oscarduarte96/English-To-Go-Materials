/**
 * ============================================================================
 * LÓGICA DEL CARRITO (CART.JS) - FIREBASE EDITION (SECURE & OPTIMIZED)
 * ============================================================================
 * Responsabilidad: 
 * 1. Gestionar estado del carrito sincronizado con Firestore.
 * 2. Sincronización en Tiempo Real (Multi-dispositivo).
 * 3. Renderizado del Drawer del carrito.
 * 4. Procesamiento de Checkout (CON VERIFICACIÓN DE PRECIOS SERVIDOR).
 * 5. Sistema de Cupones y Acceso Gratuito para Estudiantes.
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
    getDoc,
    query,
    where,
    getDocs,
    increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// 2. ESTADO GLOBAL Y CONFIGURACIÓN
let unsubscribeCart = null;

window.appState = window.appState || {};
window.appState.cart = [];
window.appState.user = null;
window.appState.appliedCoupon = null; // { code, discount_percent, discount_amount, docId }

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

    // 2. Capturamos las referencias (incluyendo nuevos elementos de cupón)
    ui = {
        btnClose: document.getElementById('closeCartBtn'),
        overlay: document.getElementById('cartOverlay'),
        drawer: drawerElement,
        itemsContainer: document.getElementById('cartItemsContainer'),
        emptyMsg: document.getElementById('emptyCartMsg'),
        totalDisplay: document.getElementById('cartTotalDisplay'),
        btnCheckout: document.getElementById('btnCheckout'),
        // Nuevos elementos para cupones
        couponInput: document.getElementById('couponInput'),
        btnApplyCoupon: document.getElementById('btnApplyCoupon'),
        couponStatus: document.getElementById('couponStatus'),
        discountSummary: document.getElementById('discountSummary'),
        subtotalDisplay: document.getElementById('subtotalDisplay'),
        discountDisplay: document.getElementById('discountDisplay'),
        btnRedeemAccess: document.getElementById('btnRedeemAccess')
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

    // Nuevos eventos para cupones
    if (ui.btnApplyCoupon) ui.btnApplyCoupon.onclick = handleApplyCoupon;
    if (ui.btnRedeemAccess) ui.btnRedeemAccess.onclick = handleZeroCostCheckout;

    // Enter key en input de cupón
    if (ui.couponInput) {
        ui.couponInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyCoupon();
            }
        });
    }
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
 * 6.5 SISTEMA DE CUPONES
 */

/**
 * Valida y aplica un cupón de descuento
 */
async function handleApplyCoupon() {
    const code = ui.couponInput?.value.trim().toUpperCase();

    if (!code) {
        showCouponStatus('error', 'Por favor ingresa un código de cupón.');
        return;
    }

    // UI Loading
    ui.btnApplyCoupon.disabled = true;
    ui.btnApplyCoupon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // Buscar cupón en Firestore
        const couponsRef = collection(db, "coupons");
        const q = query(couponsRef, where("code", "==", code));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showCouponStatus('error', '❌ Cupón no válido o no existe.');
            resetCouponButton();
            return;
        }

        const couponDoc = snapshot.docs[0];
        const couponData = couponDoc.data();

        // Validar si está activo
        if (!couponData.is_active) {
            showCouponStatus('error', '❌ Este cupón ya no está activo.');
            resetCouponButton();
            return;
        }

        // Validar expiración (si aplica)
        if (couponData.valid_until) {
            const expirationDate = couponData.valid_until.toDate();
            if (new Date() > expirationDate) {
                showCouponStatus('error', '❌ Este cupón ha expirado.');
                resetCouponButton();
                return;
            }
        }

        // Validar límite de uso (si aplica)
        if (couponData.usage_limit !== null && couponData.usage_count >= couponData.usage_limit) {
            showCouponStatus('error', '❌ Este cupón ha alcanzado su límite de uso.');
            resetCouponButton();
            return;
        }

        // ✅ Cupón válido - Calcular descuento
        const cart = window.appState.cart;
        const subtotal = cart.reduce((sum, item) => sum + item.precio, 0);
        const discountPercent = couponData.discount_percent || 0;
        const discountAmount = Math.round(subtotal * (discountPercent / 100));

        // Guardar en estado global
        window.appState.appliedCoupon = {
            code: code,
            docId: couponDoc.id,
            discount_percent: discountPercent,
            discount_amount: discountAmount
        };

        // Mostrar éxito
        const percentText = discountPercent === 100 ? '¡GRATIS!' : `${discountPercent}% OFF`;
        showCouponStatus('success', `✅ Cupón "${code}" aplicado. ${percentText}`);

        // Actualizar UI del carrito
        updateCartUI();

        // Cambiar input a estado "aplicado"
        ui.couponInput.disabled = true;
        ui.couponInput.classList.add('bg-emerald-50', 'border-emerald-300');
        ui.btnApplyCoupon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        ui.btnApplyCoupon.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
        ui.btnApplyCoupon.classList.add('bg-red-50', 'text-red-500', 'border-red-200', 'hover:bg-red-100');
        ui.btnApplyCoupon.onclick = removeCoupon;
        ui.btnApplyCoupon.disabled = false;

    } catch (error) {
        console.error("Error validando cupón:", error);
        showCouponStatus('error', '❌ Error al validar el cupón. Intenta nuevamente.');
        resetCouponButton();
    }
}

/**
 * Elimina el cupón aplicado
 */
function removeCoupon() {
    window.appState.appliedCoupon = null;

    // Resetear UI
    ui.couponInput.value = '';
    ui.couponInput.disabled = false;
    ui.couponInput.classList.remove('bg-emerald-50', 'border-emerald-300');

    resetCouponButton();
    ui.couponStatus.classList.add('hidden');

    // Actualizar totales
    updateCartUI();
}

/**
 * Resetea el botón de aplicar cupón a su estado original
 */
function resetCouponButton() {
    if (!ui.btnApplyCoupon) return;
    ui.btnApplyCoupon.disabled = false;
    ui.btnApplyCoupon.innerHTML = 'Aplicar';
    ui.btnApplyCoupon.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
    ui.btnApplyCoupon.classList.remove('bg-red-50', 'text-red-500', 'border-red-200', 'hover:bg-red-100');
    ui.btnApplyCoupon.onclick = handleApplyCoupon;
}

/**
 * Muestra mensaje de estado del cupón
 * @param {string} type - 'success' o 'error'
 * @param {string} message - Mensaje a mostrar
 */
function showCouponStatus(type, message) {
    if (!ui.couponStatus) return;

    ui.couponStatus.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-700', 'bg-red-50', 'text-red-600');

    if (type === 'success') {
        ui.couponStatus.classList.add('bg-emerald-50', 'text-emerald-700');
    } else {
        ui.couponStatus.classList.add('bg-red-50', 'text-red-600');
    }

    ui.couponStatus.innerText = message;
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

    // Calcular descuento si hay cupón aplicado
    const coupon = window.appState.appliedCoupon;
    let discountAmount = 0;
    let finalTotal = total;

    if (coupon) {
        // Recalcular descuento basado en el subtotal actual
        discountAmount = Math.round(total * (coupon.discount_percent / 100));
        finalTotal = total - discountAmount;

        // Actualizar el objeto del cupón con el monto actual
        window.appState.appliedCoupon.discount_amount = discountAmount;

        // Mostrar resumen de descuento
        if (ui.discountSummary) {
            ui.discountSummary.classList.remove('hidden');
            if (ui.subtotalDisplay) {
                ui.subtotalDisplay.innerText = window.utils ? window.utils.formatCurrency(total) : `$ ${total}`;
            }
            if (ui.discountDisplay) {
                ui.discountDisplay.innerText = window.utils ? `-${window.utils.formatCurrency(discountAmount)}` : `-$ ${discountAmount}`;
            }
        }
    } else {
        // Ocultar resumen de descuento
        if (ui.discountSummary) {
            ui.discountSummary.classList.add('hidden');
        }
    }

    // Mostrar total final
    if (ui.totalDisplay) {
        ui.totalDisplay.innerText = window.utils ? window.utils.formatCurrency(finalTotal) : `$ ${finalTotal}`;

        // Estilo diferente si es gratis
        if (finalTotal === 0 && coupon) {
            ui.totalDisplay.classList.add('text-emerald-600');
            ui.totalDisplay.classList.remove('text-slate-900');
        } else {
            ui.totalDisplay.classList.remove('text-emerald-600');
            ui.totalDisplay.classList.add('text-slate-900');
        }
    }

    // Transformar botón según el total
    if (finalTotal === 0 && coupon && count > 0) {
        // Mostrar botón "Canjear Acceso" y ocultar "Finalizar Compra"
        if (ui.btnCheckout) ui.btnCheckout.classList.add('hidden');
        if (ui.btnRedeemAccess) ui.btnRedeemAccess.classList.remove('hidden');
    } else {
        // Mostrar botón normal de checkout
        if (ui.btnCheckout) ui.btnCheckout.classList.remove('hidden');
        if (ui.btnRedeemAccess) ui.btnRedeemAccess.classList.add('hidden');
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

        console.log(`Checkout Verificado: Total Local $${localCart.reduce((a, b) => a + b.precio, 0)} vs Total DB $${verifiedTotal}`);

        // C. Aplicar descuento si hay cupón
        const coupon = window.appState.appliedCoupon;
        let discountAmount = 0;
        let finalTotal = verifiedTotal;

        if (coupon) {
            discountAmount = Math.round(verifiedTotal * (coupon.discount_percent / 100));
            finalTotal = verifiedTotal - discountAmount;
        }

        // D. Construir Objeto de Orden Seguro
        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: verifiedItems,
            original_total: verifiedTotal,
            discount_amount: discountAmount,
            final_total: finalTotal,
            currency: 'COP',
            status: 'pending',
            payment_method: 'pending_payment',
            coupon_code: coupon?.code || null,
            coupon_discount_percent: coupon?.discount_percent || 0,
            created_at: serverTimestamp(),
            platform: 'web_catalog_v2'
        };

        // E. Guardar en Firestore
        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("Orden creada con ID: ", docRef.id);

        // F. Limpiar cupón y carrito
        window.appState.appliedCoupon = null;
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

/**
 * 10. CHECKOUT COSTO CERO (Para Estudiantes con Cupón 100%)
 * Omite la pasarela de pago y registra la orden como completada directamente.
 */
async function handleZeroCostCheckout() {
    // A. Verificar Autenticación
    const user = auth.currentUser;
    if (!user) {
        sessionStorage.setItem('redirect_after_login', 'checkout');
        window.location.href = '../auth/login.html';
        return;
    }

    // B. Verificar que hay un cupón 100% aplicado
    const coupon = window.appState.appliedCoupon;
    if (!coupon || coupon.discount_percent !== 100) {
        alert("Error: Este flujo solo es válido con un cupón de 100% de descuento.");
        return;
    }

    const localCart = window.appState.cart;
    if (localCart.length === 0) return;

    // UI Loading
    ui.btnRedeemAccess.disabled = true;
    ui.btnRedeemAccess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando acceso...';

    try {
        // C. Verificar precios en servidor (igual que checkout normal)
        let verifiedTotal = 0;
        const verifiedItems = [];

        const productPromises = localCart.map(item => getDoc(doc(db, "products", item.id)));
        const snapshots = await Promise.all(productPromises);

        snapshots.forEach((snap, index) => {
            if (snap.exists()) {
                const productData = snap.data();
                const realPrice = Number(productData.precio) || 0;
                verifiedTotal += realPrice;

                verifiedItems.push({
                    ...localCart[index],
                    precio: realPrice,
                    verified_at: new Date().toISOString()
                });
            }
        });

        if (verifiedItems.length === 0) {
            throw new Error("No hay productos válidos para procesar.");
        }

        // D. Crear orden como COMPLETADA (sin pasarela de pago)
        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: verifiedItems,
            original_total: verifiedTotal,
            discount_amount: verifiedTotal, // 100% de descuento
            final_total: 0,
            currency: 'COP',
            status: 'completed', // ✅ Directamente completada
            payment_method: 'coupon_redemption', // Método especial
            coupon_code: coupon.code,
            coupon_discount_percent: 100,
            redeemed_at: serverTimestamp(),
            created_at: serverTimestamp(),
            platform: 'web_catalog_v2'
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("🎁 Acceso canjeado con ID: ", docRef.id);

        // E. Incrementar contador de uso del cupón
        if (coupon.docId) {
            try {
                const couponRef = doc(db, "coupons", coupon.docId);
                await updateDoc(couponRef, {
                    usage_count: increment(1)
                });
                console.log("Contador de cupón incrementado.");
            } catch (e) {
                console.warn("No se pudo incrementar contador de cupón:", e);
            }
        }

        // F. Limpiar estado
        window.appState.appliedCoupon = null;
        removeCoupon(); // Resetear UI del cupón
        await clearCart();
        closeCart();

        // G. Feedback especial para estudiantes
        alert("🎉 ¡Acceso Canjeado Exitosamente!\n\nTus materiales ya están disponibles en tu biblioteca. ¡Disfruta aprendiendo!");
        window.location.href = '../panel/biblioteca.html';

    } catch (error) {
        console.error("Error en canje de acceso:", error);
        alert("Hubo un error al procesar tu acceso. Por favor intenta nuevamente.");
    } finally {
        if (ui.btnRedeemAccess) {
            ui.btnRedeemAccess.disabled = false;
            ui.btnRedeemAccess.innerHTML = '<i class="fa-solid fa-gift"></i> <span>Canjear Acceso Ahora</span>';
        }
    }
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);