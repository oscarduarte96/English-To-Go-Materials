/**
 * ============================================================================
 * VISTA DE DETALLE DE PRODUCTO (PRODUCTO.JS) - VERSIÓN MPA
 * ============================================================================
 * Responsabilidad: Mostrar información detallada de un producto individual.
 * Funcionalidades: Renderizado de datos, manejo de imágenes, productos relacionados, añadir al carrito.
 * Dependencias: assets/js/firebase-app.js, utils.js (global), cart.js (global logic).
 */

// 1. IMPORTACIONES
import { db } from "../../assets/js/firebase-app.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    limit,
    getDocs,
    orderBy,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { auth } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import OrderService from "./services/OrderService.js";

// 2. REFERENCIAS AL DOM
const ui = {
    // Contenedores principales
    mainContainer: document.getElementById('product-detail-container'),
    loadingSpinner: document.getElementById('page-loading'),

    // Información del producto
    image: document.getElementById('prod-image'),
    imageSkeleton: document.getElementById('prod-image-skeleton'),
    title: document.getElementById('prod-title'),
    price: document.getElementById('prod-price'),
    priceOld: document.getElementById('prod-price-old'),
    description: document.getElementById('prod-description'),
    badgesContainer: document.getElementById('prod-badges'),

    // Acción Principal (NUEVO)
    btnAddToCart: document.getElementById('btn-add-to-cart'),

    // Sidebar / Info Meta
    metaLevel: document.getElementById('meta-level'),
    metaSkill: document.getElementById('meta-skill'),
    metaType: document.getElementById('meta-type'),
    metaType: document.getElementById('meta-type'),
    metaContext: document.getElementById('meta-context'),
    metaExam: document.getElementById('meta-exam'),

    // Información del Creador (Teacher)
    teacherName: document.getElementById('teacher-name'),
    teacherPhoto: document.getElementById('teacher-photo'),
    teacherLink: document.getElementById('teacher-profile-link'),

    // Sección Relacionados
    relatedGrid: document.getElementById('related-products-grid')
};

// 3. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        window.location.href = 'catalogo.html'; // Redirigir si no hay ID
        return;
    }

    initProductPage(productId);
});

async function initProductPage(id) {
    try {
        const product = await fetchProductData(id);
        if (!product) {
            ui.mainContainer.innerHTML = `<div class="text-center py-20 text-red-500 font-bold">Producto no encontrado.</div>`;
            ui.loadingSpinner.classList.add('hidden');
            return;
        }

        renderProduct(product);
        loadRelatedProducts(product); // Cargar relacionados basados en este producto

        // Verificar compra (si aplica)
        if (!product.es_gratis) {
            setupPurchaseCheck(product.id);
        }

    } catch (error) {
        console.error("Error cargando producto:", error);
        ui.mainContainer.innerHTML = `<div class="text-center py-20 text-slate-500">Hubo un error al cargar el material.</div>`;
    } finally {
        if (ui.loadingSpinner) ui.loadingSpinner.classList.add('hidden');
        if (ui.mainContainer) ui.mainContainer.classList.remove('hidden');
    }
}

// 4. LÓGICA DE DATOS
async function fetchProductData(id) {
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    } else {
        return null;
    }
}

// 5. RENDERIZADO
function renderProduct(data) {
    // A. Títulos y Textos Básicos
    if (ui.title) ui.title.textContent = data.titulo;
    if (ui.description) ui.description.innerHTML = data.descripcion || "Sin descripción disponible.";

    // B. Precios
    if (ui.price) {
        if (data.es_gratis) {
            ui.price.textContent = "GRATIS";
            ui.price.classList.add("text-emerald-600");
            ui.price.classList.remove("text-slate-900");
        } else {
            ui.price.textContent = window.utils.formatCurrency(data.precio);
            ui.price.classList.remove("text-emerald-600");
            ui.price.classList.add("text-slate-900");
        }
    }

    // Precio anterior (oferta) - Solo si no es gratis
    if (ui.priceOld) {
        if (!data.es_gratis && data.precio_antes && data.precio_antes > data.precio) {
            ui.priceOld.textContent = window.utils.formatCurrency(data.precio_antes);
            ui.priceOld.classList.remove('hidden');
        } else {
            ui.priceOld.classList.add('hidden');
        }
    }

    // C. Imagen Principal con Fix de Race Condition
    if (ui.image) {
        const imgUrl = (data.imagenes_preview && data.imagenes_preview.length > 0)
            ? data.imagenes_preview[0]
            : 'https://via.placeholder.com/600x400?text=No+Image';

        ui.image.src = imgUrl;

        // Función para ocultar skeleton
        const imageLoaded = () => {
            if (ui.imageSkeleton) ui.imageSkeleton.classList.add('hidden');
            ui.image.classList.remove('opacity-0');
        };

        if (ui.image.complete) {
            imageLoaded();
        } else {
            ui.image.onload = imageLoaded;
            ui.image.onerror = () => {
                ui.image.src = 'assets/img/placeholder-error.png';
                imageLoaded();
            };
        }
    }

    // D. Datos del Creador
    const teacherName = data.creador_nombre || data.autor || "English To Go";
    const teacherPhoto = data.creador_foto || "https://i.imgur.com/O1F7GGy.png";

    if (ui.teacherName) ui.teacherName.textContent = teacherName;
    if (ui.teacherPhoto) ui.teacherPhoto.src = teacherPhoto;

    // E. Metadatos
    const arrayToString = (arr) => Array.isArray(arr) ? arr.join(", ") : (arr || "General");

    if (ui.metaLevel) ui.metaLevel.textContent = arrayToString(data.levels);
    if (ui.metaSkill) ui.metaSkill.textContent = arrayToString(data.skills);
    if (ui.metaType) ui.metaType.textContent = arrayToString(data.types);
    if (ui.metaContext) ui.metaContext.textContent = arrayToString(data.context);
    if (ui.metaExam) {
        ui.metaExam.textContent = (data.exams && data.exams.length > 0) ? arrayToString(data.exams) : "N/A";
        // Ocultar si no hay examen
        if (!data.exams || data.exams.length === 0) {
            ui.metaExam.parentElement.classList.add('hidden');
        } else {
            ui.metaExam.parentElement.classList.remove('hidden');
        }
    }

    // F. Badges / Etiquetas Visuales
    if (ui.badgesContainer) {
        let badgesHtml = '';

        // Badge GRATIS
        if (data.es_gratis) {
            badgesHtml += `<span class="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1.5 rounded-md font-black shadow-md mr-2 mb-2 tracking-wide transform hover:scale-105 transition-transform"><i class="fa-solid fa-gift mr-1"></i> GRATIS</span>`;
        }

        if (Array.isArray(data.levels)) {
            badgesHtml += data.levels.map(lvl =>
                `<span class="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-md font-semibold border border-indigo-100 mr-2 mb-2">
                    ${lvl.split('(')[0]}
                </span>`
            ).join('');
        }

        ui.badgesContainer.innerHTML = badgesHtml;
    }

    // G. LOGICA DE AÑADIR AL CARRITO / DESCARGAR
    if (ui.btnAddToCart) {
        // CASO GRATIS
        if (data.es_gratis) {
            // Estilo
            ui.btnAddToCart.className = "w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-emerald-500/30 flex items-center justify-center gap-3 group active:scale-95";
            ui.btnAddToCart.innerHTML = '<i class="fa-solid fa-cloud-arrow-down text-lg group-hover:animate-bounce"></i><span>Descargar Ahora</span>';

            // Acción
            ui.btnAddToCart.onclick = (e) => handleFreeDownload(data, ui.btnAddToCart);

        } else {
            // CASO PAGO (Logica original)
            // Primero, estado "loading" o "verificando" mientras carga auth
            // Se resolvera en el listener de Auth

            ui.btnAddToCart.onclick = async (e) => {
                e.preventDefault();

                // 1. Verificación de Seguridad
                if (typeof window.addToCart !== 'function') {
                    console.error("FATAL: cart.js no está cargado. window.addToCart es undefined.");
                    alert("Error técnico: El sistema de carrito no está disponible.");
                    return;
                }

                // 2. Feedback de UX (Loading State)
                const originalContent = ui.btnAddToCart.innerHTML;
                ui.btnAddToCart.disabled = true;
                ui.btnAddToCart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agregando...';
                ui.btnAddToCart.classList.add('opacity-75', 'cursor-not-allowed');

                try {
                    await window.addToCart(data);
                } catch (error) {
                    console.error("Error al procesar click de compra:", error);
                } finally {
                    setTimeout(() => {
                        if (ui.btnAddToCart) {
                            ui.btnAddToCart.disabled = false;
                            ui.btnAddToCart.innerHTML = originalContent;
                            ui.btnAddToCart.classList.remove('opacity-75', 'cursor-not-allowed');
                        }
                    }, 600);
                }
            };
        }
    }
}

// 5.5 VERIFICAR SI YA FUE COMPRADO
function setupPurchaseCheck(productId) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return; // Si no hay usuario, queda estado por defecto ("Agregar")

        try {
            // Buscar si existe en alguna orden completada
            const q = query(
                collection(db, "orders"),
                where("user_id", "==", user.uid),
                where("status", "==", "completed")
            );

            // Nota: Esto descarga todas las órdenes. Si son muchas, idealmente filtraríamos más.
            // Pero Firestore no permite array-contains en objetos complejos fácilmente sin índices.
            // Una optimización futura sería guardar purchase_history en el user doc.

            const snapshot = await getDocs(q);
            let isPurchased = false;

            for (const docSnap of snapshot.docs) {
                const orderData = docSnap.data();
                if (orderData.items && Array.isArray(orderData.items)) {
                    if (orderData.items.some(item => item.id === productId)) {
                        isPurchased = true;
                        break;
                    }
                }
            }

            if (isPurchased) {
                updateButtonToPurchased();
            }

        } catch (error) {
            console.error("Error verificando compra:", error);
        }
    });
}

function updateButtonToPurchased() {
    if (!ui.btnAddToCart) return;

    // Remover eventos anteriores (clonando nodo)
    const newBtn = ui.btnAddToCart.cloneNode(true);
    ui.btnAddToCart.parentNode.replaceChild(newBtn, ui.btnAddToCart);
    ui.btnAddToCart = newBtn; // Actualizar referencia

    ui.btnAddToCart.className = "w-full py-3.5 px-6 bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold rounded-xl transition-all flex items-center justify-center gap-3 hover:bg-indigo-100 cursor-pointer shadow-sm";
    ui.btnAddToCart.innerHTML = '<i class="fa-solid fa-folder-open text-lg"></i><span>Ver en mi Biblioteca</span>';

    ui.btnAddToCart.onclick = () => {
        window.location.href = 'panel/biblioteca.html';
    };
}

/**
 * PROCESO DE DESCARGA DIRECTA (Solo Gratuitos)
 */
async function handleFreeDownload(product, btnElement) {
    await OrderService.handleFreeDownload(product, btnElement, 'web_product_detail_direct');
}

// 6. PRODUCTOS RELACIONADOS
async function loadRelatedProducts(currentProduct) {
    if (!ui.relatedGrid) return;

    try {
        ui.relatedGrid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4"><i class="fa-solid fa-spinner fa-spin"></i> Cargando sugerencias...</div>';

        let q;
        const productsRef = collection(db, "products");

        if (currentProduct.levels && currentProduct.levels.length > 0) {
            const targetLevel = currentProduct.levels[0];
            q = query(
                productsRef,
                where("levels", "array-contains", targetLevel),
                limit(6)
            );
        } else {
            q = query(productsRef, orderBy("fecha_creacion", "desc"), limit(6));
        }

        const querySnapshot = await getDocs(q);

        const related = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => p.id !== currentProduct.id)
            .slice(0, 4);

        renderRelatedGrid(related);

    } catch (e) {
        console.error("Error cargando relacionados:", e);
        ui.relatedGrid.innerHTML = '';
    }
}

function renderRelatedGrid(products) {
    ui.relatedGrid.innerHTML = "";

    if (products.length === 0) {
        ui.relatedGrid.innerHTML = '<p class="text-sm text-slate-400 col-span-full">No hay productos relacionados por el momento.</p>';
        return;
    }

    products.forEach(p => {
        const meta = getFileMeta(p.tipo_archivo);
        const price = window.utils.formatCurrency(p.precio);
        const teacherName = p.creador_nombre || p.autor || "English To Go";

        const card = document.createElement('a');
        card.href = `producto.html?id=${p.id}`;
        card.className = "group block bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-slate-100";

        const imgHTML = (p.imagenes_preview && p.imagenes_preview.length)
            ? `<img src="${p.imagenes_preview[0]}" class="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500">`
            : `<div class="w-full h-32 bg-slate-50 flex items-center justify-center text-slate-300 text-3xl">${meta.icon}</div>`;

        card.innerHTML = `
            <div class="relative">
                ${imgHTML}
                <div class="absolute top-2 right-2">
                    <span class="${meta.class} text-[10px] text-white font-bold px-2 py-0.5 rounded shadow-sm">${meta.label}</span>
                </div>
            </div>
            <div class="p-3">
                <h4 class="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-indigo-600">${p.titulo}</h4>
                <p class="text-[10px] text-slate-500 mb-2 truncate">${teacherName}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="font-bold text-indigo-600 text-sm">${price}</span>
                    <i class="fa-solid fa-arrow-right text-xs text-slate-300 group-hover:text-indigo-500 transition-colors"></i>
                </div>
            </div>
        `;
        ui.relatedGrid.appendChild(card);
    });
}

// UTILIDAD INTERNA
function getFileMeta(t) {
    t = (t || '').toLowerCase();
    if (['zip', 'rar'].includes(t) || t.includes('zip')) return { icon: '<i class="fa-solid fa-file-zipper"></i>', label: 'ZIP', class: 'bg-amber-500' };
    if (['ppt', 'pptx'].includes(t) || t.includes('ppt')) return { icon: '<i class="fa-solid fa-file-powerpoint"></i>', label: 'PPT', class: 'bg-orange-500' };
    if (['doc', 'docx'].includes(t) || t.includes('doc')) return { icon: '<i class="fa-solid fa-file-word"></i>', label: 'DOC', class: 'bg-blue-600' };
    return { icon: '<i class="fa-solid fa-file-pdf"></i>', label: 'PDF', class: 'bg-red-500' };
}