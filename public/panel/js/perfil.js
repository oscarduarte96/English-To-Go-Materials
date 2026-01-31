/* =========================================
   PERFIL.JS - User Profile Logic
   Maneja la carga de datos y renderizado condicional
   según el rol del usuario (Estándar vs Creador)
   ========================================= */

import { auth, db } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ========================================
// 1. DOM REFERENCES
// ========================================
const ui = {
    // Profile Header
    profileBanner: document.getElementById('profileBanner'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileJoinDate: document.getElementById('profileJoinDate'),
    verifiedBadge: document.getElementById('verifiedBadge'),

    // Buttons
    btnEditProfile: document.getElementById('btnEditProfile'),
    btnEditAvatar: document.getElementById('btnEditAvatar'),
    btnEditBanner: document.getElementById('btnEditBanner'),
    btnEditBio: document.getElementById('btnEditBio'),
    btnCreatorDashboard: document.getElementById('btnCreatorDashboard'),

    // Bio & Skills
    profileBio: document.getElementById('profileBio'),
    skillsCard: document.getElementById('skillsCard'),
    skillsContainer: document.getElementById('skillsContainer'),

    // Social Links
    socialLinksCard: document.getElementById('socialLinksCard'),
    socialLinksContainer: document.getElementById('socialLinksContainer'),

    // Quick Links (Standard Users)
    quickLinksCard: document.getElementById('quickLinksCard'),

    // Creator Sections
    creatorStats: document.getElementById('creatorStats'),
    creatorProductsSection: document.getElementById('creatorProductsSection'),
    creatorProductsGrid: document.getElementById('creatorProductsGrid'),
    noProductsMsg: document.getElementById('noProductsMsg'),

    // Stats
    statProducts: document.getElementById('statProducts'),
    statSales: document.getElementById('statSales'),
    statIncome: document.getElementById('statIncome'),

    // CTA (Standard Users)
    becomeCreatorCta: document.getElementById('becomeCreatorCta'),

    // Edit Modal
    editProfileModal: document.getElementById('editProfileModal'),
    editModalBackdrop: document.getElementById('editModalBackdrop'),
    editModalPanel: document.getElementById('editModalPanel'),
    btnCloseEditModal: document.getElementById('btnCloseEditModal'),
    editProfileForm: document.getElementById('editProfileForm'),
    editName: document.getElementById('editName'),
    editBio: document.getElementById('editBio'),
    editBioContainer: document.getElementById('editBioContainer'),
    editSocialContainer: document.getElementById('editSocialContainer'),
    editLinkedIn: document.getElementById('editLinkedIn'),
    editInstagram: document.getElementById('editInstagram'),
    editWebsite: document.getElementById('editWebsite'),
    bioCharCount: document.getElementById('bioCharCount')
};

// ========================================
// 2. STATE
// ========================================
let currentUser = null;
let userData = null;
let isCreator = false;

// ========================================
// 3. INITIALIZATION
// ========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile(user.uid);
    }
});

/**
 * Load user profile data from Firestore
 */
async function loadUserProfile(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            userData = docSnap.data();
            isCreator = !!(userData.roles && userData.roles.teacher);

            // Render profile based on role
            renderProfileHeader();

            if (isCreator) {
                renderCreatorView();
            } else {
                renderStandardUserView();
            }

            setupEventListeners();
        } else {
            // User document doesn't exist - create minimal profile view
            console.warn("User document not found, showing basic profile");
            renderBasicProfile();
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        showError("Error al cargar el perfil");
    }
}

// ========================================
// 4. RENDER FUNCTIONS
// ========================================

/**
 * Render the profile header (common for all users)
 */
function renderProfileHeader() {
    // Name
    ui.profileName.textContent = currentUser.displayName || userData.nombre || "Usuario";

    // Email
    ui.profileEmail.textContent = currentUser.email;

    // Avatar
    if (currentUser.photoURL) {
        ui.profileAvatar.src = currentUser.photoURL;
    } else if (userData.photoURL) {
        ui.profileAvatar.src = userData.photoURL;
    }

    // Join Date
    const createdAt = userData.createdAt?.toDate?.() || currentUser.metadata?.creationTime;
    if (createdAt) {
        const date = new Date(createdAt);
        const options = { year: 'numeric', month: 'long' };
        ui.profileJoinDate.innerHTML = `<i class="fa-regular fa-calendar mr-1"></i> Miembro desde ${date.toLocaleDateString('es-ES', options)}`;
    }

    // Bio
    if (userData.bio) {
        ui.profileBio.textContent = userData.bio;
    }

    // Banner (if custom)
    if (userData.bannerURL) {
        ui.profileBanner.style.backgroundImage = `url(${userData.bannerURL})`;
        ui.profileBanner.style.backgroundSize = 'cover';
        ui.profileBanner.style.backgroundPosition = 'center';
    }
}

/**
 * Render the STANDARD USER view (non-creators)
 */
function renderStandardUserView() {
    console.log("[Profile] Rendering STANDARD USER view");

    // Show CTA to become creator
    ui.becomeCreatorCta.classList.remove('hidden');

    // Show quick links
    ui.quickLinksCard.classList.remove('hidden');

    // Hide creator-only elements
    ui.verifiedBadge.classList.add('hidden');
    ui.btnCreatorDashboard.classList.add('hidden');
    ui.creatorStats.classList.add('hidden');
    ui.creatorProductsSection.classList.add('hidden');
    ui.skillsCard.classList.add('hidden');
    ui.socialLinksCard.classList.add('hidden');
    ui.btnEditBio.classList.add('hidden');
}

/**
 * Render the CREATOR view
 */
async function renderCreatorView() {
    console.log("[Profile] Rendering CREATOR view");

    // Hide CTA (already a creator)
    ui.becomeCreatorCta.classList.add('hidden');

    // Show creator elements
    ui.verifiedBadge.classList.remove('hidden');
    ui.btnCreatorDashboard.classList.remove('hidden');
    ui.creatorStats.classList.remove('hidden');
    ui.creatorProductsSection.classList.remove('hidden');
    ui.btnEditBio.classList.remove('hidden');

    // Show/hide quick links for creators (they may still want access)
    ui.quickLinksCard.classList.remove('hidden');

    // Skills
    if (userData.specialties && userData.specialties.length > 0) {
        renderSkills(userData.specialties);
        ui.skillsCard.classList.remove('hidden');
    }

    // Social Links
    if (userData.socialLinks) {
        renderSocialLinks(userData.socialLinks);
        ui.socialLinksCard.classList.remove('hidden');
    }

    // Load creator stats and products
    await loadCreatorData();
}

/**
 * Render skills/specialties tags
 */
function renderSkills(skills) {
    ui.skillsContainer.innerHTML = skills.map(skill => `
        <span class="skill-tag px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600">
            ${skill}
        </span>
    `).join('');
}

/**
 * Render social links
 */
function renderSocialLinks(links) {
    const socialIcons = {
        linkedin: { icon: 'fa-brands fa-linkedin', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
        instagram: { icon: 'fa-brands fa-instagram', color: 'text-pink-600 bg-pink-50 hover:bg-pink-100' },
        twitter: { icon: 'fa-brands fa-x-twitter', color: 'text-slate-800 bg-slate-100 hover:bg-slate-200' },
        youtube: { icon: 'fa-brands fa-youtube', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
        website: { icon: 'fa-solid fa-globe', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
        tiktok: { icon: 'fa-brands fa-tiktok', color: 'text-slate-800 bg-slate-100 hover:bg-slate-200' }
    };

    let html = '';
    for (const [key, url] of Object.entries(links)) {
        if (url && socialIcons[key]) {
            const config = socialIcons[key];
            html += `
                <a href="${url}" target="_blank" rel="noopener noreferrer"
                    class="social-link w-10 h-10 rounded-xl ${config.color} flex items-center justify-center transition-all">
                    <i class="${config.icon} text-lg"></i>
                </a>
            `;
        }
    }
    ui.socialLinksContainer.innerHTML = html || '<p class="text-xs text-slate-400">Sin redes sociales configuradas</p>';
}

/**
 * Load creator-specific data: products, stats
 */
async function loadCreatorData() {
    try {
        // Query products by this creator
        const productsQuery = query(
            collection(db, "products"),
            where("creador_uid", "==", currentUser.uid)
        );

        const snapshot = await getDocs(productsQuery);
        const products = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            products.push({ id: doc.id, ...data });
        });

        // Client-side sort (Newest first)
        products.sort((a, b) => {
            const dateA = a.fecha_creacion ? (a.fecha_creacion.toMillis ? a.fecha_creacion.toMillis() : new Date(a.fecha_creacion).getTime()) : 0;
            const dateB = b.fecha_creacion ? (b.fecha_creacion.toMillis ? b.fecha_creacion.toMillis() : new Date(b.fecha_creacion).getTime()) : 0;
            return dateB - dateA;
        });

        // 2. Fetch Sales & Income (Iterate orders like in Portafolio)
        let totalSales = 0;
        let totalIncome = 0;

        const ordersQuery = query(collection(db, "orders"));
        const ordersSnapshot = await getDocs(ordersQuery);

        ordersSnapshot.forEach(orderDoc => {
            const orderData = orderDoc.data();
            if (orderData.items && Array.isArray(orderData.items)) {
                orderData.items.forEach(item => {
                    // Check if this item belongs to the current creator
                    if (item.autor_id === currentUser.uid) {
                        totalSales++;
                        totalIncome += (item.price || 0);
                    }
                });
            }
        });

        // Update stats
        ui.statProducts.textContent = products.length;
        ui.statSales.textContent = totalSales;

        // Format Income
        if (window.utils && window.utils.formatCurrency) {
            ui.statIncome.textContent = window.utils.formatCurrency(totalIncome);
        } else {
            ui.statIncome.textContent = `$ ${totalIncome.toLocaleString('es-CO')} COP`;
        }


        // Render products grid (Show only latest 6)
        if (products.length > 0) {
            renderCreatorProducts(products.slice(0, 6));
            ui.noProductsMsg.classList.add('hidden');
        } else {
            ui.creatorProductsGrid.innerHTML = '';
            ui.noProductsMsg.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error loading creator data:", error);
    }
}

/**
 * Render creator's products mini-grid
 */
function renderCreatorProducts(products) {
    ui.creatorProductsGrid.innerHTML = products.map(p => {
        const img = p.imagenes_preview?.[0] || 'https://via.placeholder.com/150?text=No+Image';
        const price = p.es_gratis ? 'GRATIS' : `$${p.precio}`;
        const priceClass = p.es_gratis ? 'text-accent' : 'text-slate-900';

        return `
            <a href="../producto.html?id=${p.id}" class="product-mini-card bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex group">
                <div class="w-24 h-24 flex-shrink-0 bg-slate-100 overflow-hidden">
                    <img src="${img}" alt="${p.titulo}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                </div>
                <div class="p-3 flex flex-col justify-center flex-1 min-w-0">
                    <h4 class="font-bold text-sm text-slate-800 truncate group-hover:text-primary transition-colors">${p.titulo}</h4>
                    <p class="text-[11px] text-slate-400 mt-1">
                        <i class="fa-solid fa-shopping-cart mr-1"></i> ${p.ventas || 0} ventas
                    </p>
                    <p class="font-black ${priceClass} text-sm mt-1">${price}</p>
                </div>
            </a>
        `;
    }).join('');
}

/**
 * Render basic profile when no Firestore doc exists
 */
function renderBasicProfile() {
    ui.profileName.textContent = currentUser.displayName || "Usuario";
    ui.profileEmail.textContent = currentUser.email;

    if (currentUser.photoURL) {
        ui.profileAvatar.src = currentUser.photoURL;
    }

    // Show standard user view by default
    renderStandardUserView();
}

// ========================================
// 5. EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Edit Profile Button
    ui.btnEditProfile.addEventListener('click', openEditModal);

    // Close Edit Modal
    ui.btnCloseEditModal.addEventListener('click', closeEditModal);
    ui.editModalBackdrop.addEventListener('click', closeEditModal);

    // Bio char counter
    ui.editBio.addEventListener('input', () => {
        ui.bioCharCount.textContent = ui.editBio.value.length;
    });

    // Edit Bio inline button (for creators)
    ui.btnEditBio?.addEventListener('click', openEditModal);

    // Submit edit form
    ui.editProfileForm.addEventListener('submit', handleProfileUpdate);

    // ESC to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !ui.editProfileModal.classList.contains('hidden')) {
            closeEditModal();
        }
    });
}

/**
 * Open the edit profile modal
 */
function openEditModal() {
    // Populate current values
    ui.editName.value = currentUser.displayName || userData?.nombre || '';
    ui.editBio.value = userData?.bio || '';
    ui.bioCharCount.textContent = ui.editBio.value.length;

    // Show/hide social fields for creators
    if (isCreator) {
        ui.editSocialContainer.classList.remove('hidden');
        ui.editLinkedIn.value = userData?.socialLinks?.linkedin || '';
        ui.editInstagram.value = userData?.socialLinks?.instagram || '';
        ui.editWebsite.value = userData?.socialLinks?.website || '';
    } else {
        ui.editSocialContainer.classList.add('hidden');
    }

    // Show modal with animation
    ui.editProfileModal.classList.remove('hidden');
    setTimeout(() => {
        ui.editModalPanel.classList.remove('scale-95', 'opacity-0');
        ui.editModalPanel.classList.add('scale-100', 'opacity-100');
    }, 10);

    document.body.style.overflow = 'hidden';
}

/**
 * Close the edit profile modal
 */
function closeEditModal() {
    ui.editModalPanel.classList.add('scale-95', 'opacity-0');
    ui.editModalPanel.classList.remove('scale-100', 'opacity-100');

    setTimeout(() => {
        ui.editProfileModal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 200);
}

/**
 * Handle profile update form submission
 */
async function handleProfileUpdate(e) {
    e.preventDefault();

    const submitBtn = ui.editProfileForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    submitBtn.disabled = true;

    try {
        const updates = {
            nombre: ui.editName.value.trim(),
            bio: ui.editBio.value.trim(),
            updatedAt: new Date()
        };

        // Add social links for creators
        if (isCreator) {
            updates.socialLinks = {
                linkedin: ui.editLinkedIn.value.trim() || null,
                instagram: ui.editInstagram.value.trim() || null,
                website: ui.editWebsite.value.trim() || null
            };
        }

        // Update Firestore
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, updates);

        // Update local state
        userData = { ...userData, ...updates };

        // Update UI
        ui.profileName.textContent = updates.nombre || currentUser.displayName;
        ui.profileBio.textContent = updates.bio || 'Aún no has agregado una biografía...';

        if (isCreator && updates.socialLinks) {
            renderSocialLinks(updates.socialLinks);
            ui.socialLinksCard.classList.remove('hidden');
        }

        closeEditModal();
        showSuccess('Perfil actualizado correctamente');

    } catch (error) {
        console.error("Error updating profile:", error);
        showError('Error al actualizar el perfil');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ========================================
// 6. UTILITY FUNCTIONS
// ========================================

function showError(message) {
    // Simple alert for now - could be replaced with toast
    alert('❌ ' + message);
}

function showSuccess(message) {
    // Simple alert for now - could be replaced with toast
    console.log('✅ ' + message);
}
