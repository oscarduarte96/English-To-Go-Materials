/**
 * ============================================================================
 * LÓGICA DEL CARRITO (CART.JS) - FIREBASE EDITION (SECURE & DYNAMIC)
 * ============================================================================
 * Responsabilidad: 
 * 1. Gestionar estado del carrito sincronizado con Firestore.
 * 2. Sincronización en Tiempo Real (Multi-dispositivo).
 * 3. Renderizado del Drawer del carrito (Cálculo dinámico de descuentos).
 * 4. Procesamiento de Checkout (CON VERIFICACIÓN DE PRECIOS SERVIDOR).
 * 5. Sistema de Cupones Inteligente (Discrimina productos permitidos/no permitidos).
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
window.appState.appliedCoupon = null; // { code, discount_percent, docId } -> Ya no guardamos montos fijos aquí

// 3. REFERENCIAS AL DOM
let ui = {};

/**
 * 5. INICIALIZACIÓN
 */
async function init() {
    await customElements.whenDefined('app-cart-drawer');
    const drawerElement = document.getElementById('cartDrawer');

    if (!drawerElement) {
        console.error("Error crítico: El componente app-cart-drawer se definió pero no renderizó el ID #cartDrawer.");
        return;
    }

    ui = {
        btnClose: document.getElementById('closeCartBtn'),
        overlay: document.getElementById('cartOverlay'),
        drawer: drawerElement,
        itemsContainer: document.getElementById('cartItemsContainer'),
        emptyMsg: document.getElementById('emptyCartMsg'),
        totalDisplay: document.getElementById('cartTotalDisplay'),
        btnCheckout: document.getElementById('btnCheckout'),
        couponInput: document.getElementById('couponInput'),
        btnApplyCoupon: document.getElementById('btnApplyCoupon'),
        couponStatus: document.getElementById('couponStatus'),
        discountSummary: document.getElementById('discountSummary'),
        subtotalDisplay: document.getElementById('subtotalDisplay'),
        discountDisplay: document.getElementById('discountDisplay'),
        btnRedeemAccess: document.getElementById('btnRedeemAccess')
    };

    setupEventListeners();
    setupAuthListener();
}

function setupEventListeners() {
    window.addEventListener('toggle-cart', () => openCart());

    if (ui.btnClose) ui.btnClose.onclick = closeCart;
    if (ui.overlay) ui.overlay.onclick = closeCart;
    if (ui.btnCheckout) ui.btnCheckout.onclick = handleCheckout;

    if (ui.btnApplyCoupon) ui.btnApplyCoupon.onclick = handleApplyCoupon;
    if (ui.btnRedeemAccess) ui.btnRedeemAccess.onclick = handleZeroCostCheckout;

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
        const intent = {
            type: 'open_product',
            productId: product.id,
            returnUrl: window.location.href
        };
        sessionStorage.setItem('pending_intent', JSON.stringify(intent));
        window.location.href = '../auth/login.html?mode=register';
        return;
    }

    const exists = window.appState.cart.find(item => item.id === product.id);
    if (exists) {
        openCart();
        return;
    }

    // MODIFICADO: Guardamos la propiedad 'allowDiscounts' en el item del carrito
    // Esto permite que el carrito sepa inmediatamente si el producto acepta cupones.
    const cartItem = {
        id: product.id,
        titulo: product.titulo,
        precio: Number(product.precio),
        imagen: product.imagenes_preview && product.imagenes_preview.length > 0
            ? product.imagenes_preview[0]
            : null,
        tipo: product.tipo_archivo || 'Digital',
        autor_id: product._normalizedTeacherId || 'unknown',
        // 🔥 VALIDACIÓN CRÍTICA: Guardamos si permite descuentos (true/false)
        allowDiscounts: product.allowDiscounts !== false && product.allowDiscounts !== "false"
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
 * 6.5 SISTEMA DE CUPONES (CORREGIDO PARA VALIDACIÓN DINÁMICA)
 */

async function handleApplyCoupon() {
    const code = ui.couponInput?.value.trim().toUpperCase();

    if (!code) {
        showCouponStatus('error', 'Por favor ingresa un código de cupón.');
        return;
    }

    ui.btnApplyCoupon.disabled = true;
    ui.btnApplyCoupon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
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

        if (!couponData.is_active) {
            showCouponStatus('error', '❌ Este cupón ya no está activo.');
            resetCouponButton();
            return;
        }

        if (couponData.valid_until) {
            const expirationDate = couponData.valid_until.toDate();
            if (new Date() > expirationDate) {
                showCouponStatus('error', '❌ Este cupón ha expirado.');
                resetCouponButton();
                return;
            }
        }

        if (couponData.usage_limit !== null && couponData.usage_count >= couponData.usage_limit) {
            showCouponStatus('error', '❌ Este cupón ha alcanzado su límite de uso.');
            resetCouponButton();
            return;
        }

        // MODIFICADO: Ya no calculamos el descuento fijo aquí.
        // Solo guardamos la "regla" del cupón. El renderizado calculará a qué aplica.
        window.appState.appliedCoupon = {
            code: code,
            docId: couponDoc.id,
            discount_percent: couponData.discount_percent || 0
        };

        // UI Feedback
        const percentText = couponData.discount_percent === 100 ? '¡GRATIS!' : `${couponData.discount_percent}% OFF`;
        showCouponStatus('success', `✅ Cupón "${code}" activo. ${percentText} en productos seleccionados.`);

        updateCartUI(); // Esto disparará el cálculo real

        // UI Updates
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

function removeCoupon() {
    window.appState.appliedCoupon = null;

    ui.couponInput.value = '';
    ui.couponInput.disabled = false;
    ui.couponInput.classList.remove('bg-emerald-50', 'border-emerald-300');

    resetCouponButton();
    ui.couponStatus.classList.add('hidden');

    updateCartUI();
}

function resetCouponButton() {
    if (!ui.btnApplyCoupon) return;
    ui.btnApplyCoupon.disabled = false;
    ui.btnApplyCoupon.innerHTML = 'Aplicar';
    ui.btnApplyCoupon.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
    ui.btnApplyCoupon.classList.remove('bg-red-50', 'text-red-500', 'border-red-200', 'hover:bg-red-100');
    ui.btnApplyCoupon.onclick = handleApplyCoupon;
}

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
 * 7. RENDERIZADO UI (CÁLCULO DINÁMICO DE TOTALES)
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
        if (window.appState.appliedCoupon) removeCoupon();
        return;
    }

    if (ui.emptyMsg) ui.emptyMsg.classList.add('hidden');
    if (ui.btnCheckout) {
        ui.btnCheckout.disabled = false;
        ui.btnCheckout.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    ui.itemsContainer.innerHTML = '';

    // Variables para cálculo dinámico
    let total = 0;
    let eligibleSubtotal = 0; // Subtotal de productos que SÍ aceptan descuento

    cart.forEach(item => {
        total += item.precio;

        // 🔥 LÓGICA DINÁMICA: Chequeamos la propiedad en tiempo real
        // Si el item no tiene la propiedad definida (items viejos), asumimos true por compatibilidad, 
        // o false si prefieres ser estricto. Aquí asumimos que si no es explícitamente false, es true.
        const isEligible = item.allowDiscounts !== false;

        if (isEligible) {
            eligibleSubtotal += item.precio;
        }

        const div = document.createElement('div');
        div.className = "flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md";

        const imgHtml = item.imagen
            ? `<img src="${item.imagen}" class="w-16 h-16 rounded-lg object-cover border border-slate-100">`
            : `<div class="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xl"><i class="fa-solid fa-file"></i></div>`;

        const precioFormateado = window.utils ? window.utils.formatCurrency(item.precio) : `$ ${item.precio}`;

        // Indicador visual si el producto NO aplica para cupón (opcional pero útil)
        const noDiscountBadge = !isEligible && window.appState.appliedCoupon
            ? `<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2">No Dto.</span>`
            : '';

        div.innerHTML = `
            ${imgHtml}
            <div class="flex-grow min-w-0">
                <h4 class="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-1">${item.titulo}</h4>
                <div class="flex items-center">
                    <p class="text-indigo-600 font-black text-sm">${precioFormateado}</p>
                    ${noDiscountBadge}
                </div>
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

    // Calcular montos finales
    const coupon = window.appState.appliedCoupon;
    let discountAmount = 0;
    let finalTotal = total;

    if (coupon) {
        // El descuento se calcula SOLO sobre el subtotal elegible
        discountAmount = Math.round(eligibleSubtotal * (coupon.discount_percent / 100));

        // El total final es el Total Global menos el Descuento calculado
        finalTotal = total - discountAmount;

        // Actualizamos el objeto cupón en memoria con el monto actual para uso en checkout
        window.appState.appliedCoupon.discount_amount = discountAmount;

        if (ui.discountSummary) {
            ui.discountSummary.classList.remove('hidden');
            if (ui.subtotalDisplay) {
                ui.subtotalDisplay.innerText = window.utils ? window.utils.formatCurrency(total) : `$ ${total}`;
            }
            if (ui.discountDisplay) {
                ui.discountDisplay.innerText = window.utils ? `-${window.utils.formatCurrency(discountAmount)}` : `-$ ${discountAmount}`;
            }

            // Si hay productos no elegibles, avisar en el status
            if (eligibleSubtotal < total && ui.couponStatus) {
                ui.couponStatus.innerText = `⚠️ Cupón aplicado solo a productos válidos.`;
                ui.couponStatus.classList.remove('bg-emerald-50', 'text-emerald-700');
                ui.couponStatus.classList.add('bg-orange-50', 'text-orange-700');
            } else if (ui.couponStatus) {
                // Restaurar estilo verde si todo es válido
                ui.couponStatus.classList.add('bg-emerald-50', 'text-emerald-700');
                ui.couponStatus.classList.remove('bg-orange-50', 'text-orange-700');
            }
        }
    } else {
        if (ui.discountSummary) {
            ui.discountSummary.classList.add('hidden');
        }
    }

    if (ui.totalDisplay) {
        ui.totalDisplay.innerText = window.utils ? window.utils.formatCurrency(finalTotal) : `$ ${finalTotal}`;

        if (finalTotal === 0 && coupon) {
            ui.totalDisplay.classList.add('text-emerald-600');
            ui.totalDisplay.classList.remove('text-slate-900');
        } else {
            ui.totalDisplay.classList.remove('text-emerald-600');
            ui.totalDisplay.classList.add('text-slate-900');
        }
    }

    if (finalTotal === 0 && coupon && count > 0) {
        if (ui.btnCheckout) ui.btnCheckout.classList.add('hidden');
        if (ui.btnRedeemAccess) ui.btnRedeemAccess.classList.remove('hidden');
    } else {
        if (ui.btnCheckout) ui.btnCheckout.classList.remove('hidden');
        if (ui.btnRedeemAccess) ui.btnRedeemAccess.classList.add('hidden');
    }
}

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
    const user = auth.currentUser;
    if (!user) {
        sessionStorage.setItem('redirect_after_login', 'checkout');
        window.location.href = '../auth/login.html';
        return;
    }

    const localCart = window.appState.cart;
    if (localCart.length === 0) return;

    ui.btnCheckout.disabled = true;
    ui.btnCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando precios...';

    try {
        let verifiedTotal = 0;
        const verifiedItems = [];
        const missingItems = [];

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
            } else {
                missingItems.push(localCart[index].titulo);
            }
        });

        if (missingItems.length > 0) {
            alert(`Atención: Algunos productos ya no están disponibles y fueron removidos de la orden: \n- ${missingItems.join('\n- ')}`);
            ui.btnCheckout.disabled = false;
            ui.btnCheckout.innerHTML = '<span>Finalizar Compra</span> <i class="fa-solid fa-arrow-right"></i>';
            return;
        }

        if (verifiedItems.length === 0) {
            throw new Error("No hay productos válidos para procesar.");
        }

        // C. Aplicar descuento si hay cupón (CON VALIDACIÓN DE ELEGIBILIDAD DEL SERVIDOR)
        const coupon = window.appState.appliedCoupon;
        let discountAmount = 0;
        let finalTotal = verifiedTotal;

        if (coupon) {
            let eligibleCurrentTotal = 0;

            // Recorremos los items verificados para sumar solo los elegibles
            // Usando los datos FRESCOS de la base de datos (snapshots)
            verifiedItems.forEach((item, index) => {
                const snap = snapshots[index];
                if (snap.exists()) {
                    const prod = snap.data();
                    // Validación estricta usando datos del servidor
                    const isDiscountsAllowed = prod.allowDiscounts !== false && prod.allowDiscounts !== "false";

                    if (isDiscountsAllowed) {
                        eligibleCurrentTotal += item.precio;
                    }
                }
            });

            discountAmount = Math.round(eligibleCurrentTotal * (coupon.discount_percent / 100));
            finalTotal = verifiedTotal - discountAmount;
        }

        const authorIds = [...new Set(verifiedItems.map(item => item.autor_id).filter(id => id && id !== 'unknown'))];

        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: verifiedItems,
            author_ids: authorIds,
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

        const docRef = await addDoc(collection(db, "orders"), orderData);

        window.appState.appliedCoupon = null;
        await clearCart();
        closeCart();

        window.location.href = `../checkout.html?order_id=${docRef.id}`;

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
 * 10. CHECKOUT COSTO CERO
 */
async function handleZeroCostCheckout() {
    const user = auth.currentUser;
    if (!user) {
        sessionStorage.setItem('redirect_after_login', 'checkout');
        window.location.href = '../auth/login.html';
        return;
    }

    const coupon = window.appState.appliedCoupon;
    if (!coupon || coupon.discount_percent !== 100) {
        alert("Error: Este flujo solo es válido con un cupón de 100% de descuento.");
        return;
    }

    const localCart = window.appState.cart;
    if (localCart.length === 0) return;

    ui.btnRedeemAccess.disabled = true;
    ui.btnRedeemAccess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando acceso...';

    try {
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

        // Recalcular Totales con Elegibilidad (Servidor)
        let eligibleTotal = 0;
        snapshots.forEach((snap, index) => {
            if (snap.exists()) {
                const prod = snap.data();
                const isDiscountsAllowed = prod.allowDiscounts !== false && prod.allowDiscounts !== "false";

                if (isDiscountsAllowed) {
                    eligibleTotal += verifiedItems[index].precio;
                }
            }
        });

        // Calcular descuento real
        const discountAmount = Math.round(eligibleTotal * (coupon.discount_percent / 100));
        const finalTotal = verifiedTotal - discountAmount;

        // VERIFICACIÓN CRÍTICA
        if (finalTotal > 0) {
            alert(`Este cupón no cubre la totalidad del carrito porque algunos productos no admiten descuentos.\n\nTotal a pagar: $ ${finalTotal}\n\nSerás redirigido al checkout normal.`);
            ui.btnRedeemAccess.disabled = false;
            ui.btnRedeemAccess.innerHTML = '<i class="fa-solid fa-gift"></i> <span>Canjear Acceso Ahora</span>';
            handleCheckout();
            return;
        }

        const authorIds = [...new Set(verifiedItems.map(item => item.autor_id).filter(id => id && id !== 'unknown'))];

        const orderData = {
            user_id: user.uid,
            user_email: user.email,
            user_name: user.displayName || "Usuario",
            items: verifiedItems,
            author_ids: authorIds,
            original_total: verifiedTotal,
            discount_amount: discountAmount,
            final_total: 0,
            currency: 'COP',
            status: 'completed',
            payment_method: 'coupon_redemption',
            coupon_code: coupon.code,
            coupon_discount_percent: 100,
            redeemed_at: serverTimestamp(),
            created_at: serverTimestamp(),
            platform: 'web_catalog_v2'
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("🎁 Acceso canjeado con ID: ", docRef.id);

        if (coupon.docId) {
            try {
                const couponRef = doc(db, "coupons", coupon.docId);
                await updateDoc(couponRef, {
                    usage_count: increment(1)
                });
            } catch (e) {
                console.warn("No se pudo incrementar contador de cupón:", e);
            }
        }

        window.appState.appliedCoupon = null;
        removeCoupon();
        await clearCart();
        closeCart();

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