/* =========================================
   PERFIL.JS - User Profile Logic
   Maneja la carga de datos y renderizado condicional
   según el rol del usuario (Estándar vs Creador)
   ========================================= */

import { auth, db, storage } from "../../assets/js/firebase-app.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
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
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";
import ProductModal from "../../js/product-modal.js";

// ========================================
// 1. DOM REFERENCES
// ========================================
const ui = {
    // Profile Header
    profileBanner: document.getElementById('profileBanner'),
    profileAvatar: document.getElementById('profileAvatar'),
    avatarLoading: document.getElementById('avatarLoading'),
    fileAvatar: document.getElementById('fileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileJoinDate: document.getElementById('profileJoinDate'),
    verifiedBadge: document.getElementById('verifiedBadge'),

    // Buttons
    btnEditProfile: document.getElementById('btnEditProfile'),
    btnEditAvatar: document.getElementById('btnEditAvatar'),
    btnEditBanner: document.getElementById('btnEditBanner'),
    btnEditBio: document.getElementById('btnEditBio'),
    btnEditBanner: document.getElementById('btnEditBanner'),
    btnEditBio: document.getElementById('btnEditBio'),
    btnCreatorDashboard: document.getElementById('btnCreatorDashboard'),
    btnShareProfile: document.getElementById('btnShareProfile'),

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

    // Sidebar References
    sidebar: document.getElementById('sidebar'),
    mobileOverlay: document.getElementById('mobileOverlay'),
    teachersList: document.getElementById('teachersList'),
    teacherSearch: document.getElementById('teacherSearch'),
    creatorCta: document.getElementById('creatorCta'),

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
    editTwitter: document.getElementById('editTwitter'),
    editYoutube: document.getElementById('editYoutube'),
    editTiktok: document.getElementById('editTiktok'),
    editWebsite: document.getElementById('editWebsite'),
    bioCharCount: document.getElementById('bioCharCount')
};

// ========================================
// 2. STATE
// ========================================
let currentUser = null;
let userData = null;
let isCreator = false;
let isPublicView = false;  // True when viewing another user's profile

let profileUid = null;     // UID of the profile being viewed
let allTeachers = [];      // Cache for sidebar teacher search

// ========================================
// 3. INITIALIZATION - DUAL VIEW DETECTION
// ========================================

// Check for uid parameter in URL
const urlParams = new URLSearchParams(window.location.search);
const uidParam = urlParams.get('uid');

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (uidParam) {
        // URL has uid parameter -> ALWAYS Public View (from sidebar/external links)
        // This ensures clicking on any creator in the sidebar shows the read-only public profile
        isPublicView = true;
        profileUid = uidParam;
        console.log("[Profile] Public view for uid:", uidParam);
        await loadPublicProfile(uidParam);
    } else if (user) {
        // No uid param, user logged in -> Private View of own profile (from panel/dashboard)
        isPublicView = false;
        profileUid = user.uid;
        console.log("[Profile] Private view (no uid param)");
        await loadUserProfile(user.uid);
    }
    // Note: If no uid param AND not logged in, guard.js will redirect to login

    // Init Modules
    ProductModal.init();

    // Init Sidebar
    initSidebar();
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

/**
 * Load PUBLIC profile data (for viewing other users)
 */
async function loadPublicProfile(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            userData = docSnap.data();
            isCreator = !!(userData.roles && userData.roles.teacher);

            // Render PUBLIC view
            renderPublicProfileHeader();
            renderPublicView();

            // Update page title
            const name = userData.displayName || userData.nombre || 'Profesor';
            document.title = `${name} | English To Go Materials`;

        } else {
            console.warn("Public profile not found");
            showProfileNotFound();
        }
    } catch (error) {
        console.error("Error loading public profile:", error);
        showError("Error al cargar el perfil público");
    }
}

/**
 * Show profile not found message
 */
function showProfileNotFound() {
    ui.profileName.textContent = "Perfil no encontrado";
    ui.profileEmail.textContent = "";
    ui.profileBio.textContent = "Este perfil no existe o ha sido eliminado.";

    // Hide all sections
    ui.creatorStats?.classList.add('hidden');
    ui.creatorProductsSection?.classList.add('hidden');
    ui.becomeCreatorCta?.classList.add('hidden');
    ui.quickLinksCard?.classList.add('hidden');
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
 * Render the PUBLIC profile header (for viewing other users)
 */
function renderPublicProfileHeader() {
    // Name (from userData, not currentUser)
    ui.profileName.textContent = userData.displayName || userData.nombre || "Profesor";

    // Email - hide for privacy in public view
    ui.profileEmail.textContent = "";

    // Avatar
    if (userData.photoURL) {
        ui.profileAvatar.src = userData.photoURL;
    }

    // Join Date
    const createdAt = userData.createdAt?.toDate?.();
    if (createdAt) {
        const date = new Date(createdAt);
        const options = { year: 'numeric', month: 'long' };
        ui.profileJoinDate.innerHTML = `<i class="fa-regular fa-calendar mr-1"></i> Miembro desde ${date.toLocaleDateString('es-ES', options)}`;
    } else {
        ui.profileJoinDate.innerHTML = '';
    }

    // Bio
    if (userData.bio) {
        ui.profileBio.textContent = userData.bio;
    } else {
        ui.profileBio.textContent = "Este creador aún no ha agregado una biografía.";
    }

    // Banner (if custom)
    if (userData.bannerURL) {
        ui.profileBanner.style.backgroundImage = `url(${userData.bannerURL})`;
        ui.profileBanner.style.backgroundSize = 'cover';
        ui.profileBanner.style.backgroundPosition = 'center';
    }
}

/**
 * Render the PUBLIC VIEW (read-only, for viewing other users' profiles)
 */
async function renderPublicView() {
    console.log("[Profile] Rendering PUBLIC view");

    // === HIDE ALL EDIT CONTROLS ===
    ui.btnEditProfile?.classList.add('hidden');
    ui.btnEditAvatar?.classList.add('hidden');
    ui.btnEditBanner?.classList.add('hidden');
    ui.btnEditBio?.classList.add('hidden');
    ui.btnCreatorDashboard?.classList.add('hidden');

    // Hide "Become Creator" CTA (not relevant for public view)
    ui.becomeCreatorCta?.classList.add('hidden');

    // Hide quick links (private user navigation)
    ui.quickLinksCard?.classList.add('hidden');

    // Hide edit modal entirely
    ui.editProfileModal?.classList.add('hidden');

    // === SHOW PUBLIC ELEMENTS ===
    if (isCreator) {
        // Show verified badge
        ui.verifiedBadge?.classList.remove('hidden');

        // Show products section (but hide "upload" link)
        ui.creatorProductsSection?.classList.remove('hidden');
        const uploadLink = ui.creatorProductsSection?.querySelector('a[href="publicacion.html"]');
        uploadLink?.classList.add('hidden');

        // Update section title for public view
        const sectionTitle = ui.creatorProductsSection?.querySelector('h2');
        if (sectionTitle) {
            const name = (userData.displayName || userData.nombre || 'Este creador').split(' ')[0];
            sectionTitle.innerHTML = `<i class="fa-solid fa-store text-primary"></i> Materiales de ${name}`;
        }

        // Show skills if available
        if (userData.specialties && userData.specialties.length > 0) {
            renderSkills(userData.specialties);
            ui.skillsCard?.classList.remove('hidden');
        }

        // Show social links if available
        if (userData.socialLinks) {
            renderSocialLinks(userData.socialLinks);
            ui.socialLinksCard?.classList.remove('hidden');
        }

        // === CRITICAL PRIVACY FIX: MULTI-LAYER STATS HIDING ===
        // Layer 1: classList.add('hidden') + Tailwind CSS
        ui.creatorStats?.classList.add('hidden');

        // Layer 2: Inline style (highest priority, survives CSS overrides)
        if (ui.creatorStats) {
            ui.creatorStats.style.display = 'none';
            ui.creatorStats.style.visibility = 'hidden';
        }

        // Layer 3: HTML hidden attribute (semantic + browser default)
        ui.creatorStats?.setAttribute('hidden', 'true');

        // Layer 4: ARIA hidden for screen readers
        ui.creatorStats?.setAttribute('aria-hidden', 'true');

        console.log('[PRIVACY] Stats hidden in public view - Multi-layer protection active');

        // Load and render products
        await loadCreatorProductsPublic(profileUid);
    } else {
        // Non-creator public profile - just show basic info
        ui.verifiedBadge?.classList.add('hidden');
        ui.creatorStats?.classList.add('hidden');
        ui.creatorProductsSection?.classList.add('hidden');
    }

    // Setup Share Button for Public View
    setupShareEvent(profileUid);

    // === SECURITY VALIDATION: Runtime Check ===
    setTimeout(() => validateStatsHiddenInPublicView(), 100);
}

/**
 * Load creator's products for PUBLIC view
 */
async function loadCreatorProductsPublic(creatorUid) {
    try {
        const productsQuery = query(
            collection(db, "products"),
            where("creador_uid", "==", creatorUid)
        );

        const snapshot = await getDocs(productsQuery);
        const products = [];

        snapshot.forEach(docItem => {
            const data = docItem.data();
            products.push({ id: docItem.id, ...data });
        });

        // Client-side sort (Newest first)
        products.sort((a, b) => {
            const dateA = a.fecha_creacion ? (a.fecha_creacion.toMillis ? a.fecha_creacion.toMillis() : new Date(a.fecha_creacion).getTime()) : 0;
            const dateB = b.fecha_creacion ? (b.fecha_creacion.toMillis ? b.fecha_creacion.toMillis() : new Date(b.fecha_creacion).getTime()) : 0;
            return dateB - dateA;
        });

        // Render products grid (Show latest 6)
        if (products.length > 0) {
            renderCreatorProducts(products.slice(0, 6));
            ui.noProductsMsg?.classList.add('hidden');
        } else {
            ui.creatorProductsGrid.innerHTML = '';
            if (ui.noProductsMsg) {
                ui.noProductsMsg.innerHTML = `
                    <i class="fa-solid fa-box-open text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-500 font-medium">Este creador aún no ha publicado materiales</p>
                `;
                ui.noProductsMsg.classList.remove('hidden');
            }
        }

    } catch (error) {
        console.error("Error loading creator products:", error);
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

    // Setup Share Button for Private View (Self Sharing)
    setupShareEvent(currentUser.uid);

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
    // 1. FIRST PRIORITY: LOAD PRODUCTS
    // We do this first and independently so materials appear even if stats fail
    try {
        console.log("[Profile] Loading creator products...");
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

        // Render products grid (Show only latest 6)
        if (products.length > 0) {
            renderCreatorProducts(products.slice(0, 6));
            ui.noProductsMsg.classList.add('hidden');
            ui.statProducts.textContent = products.length; // Update product count from actual products
        } else {
            ui.creatorProductsGrid.innerHTML = '';
            ui.noProductsMsg.classList.remove('hidden');
            ui.statProducts.textContent = "0";
        }
    } catch (error) {
        console.error("Critical Error loading creator products:", error);
        ui.creatorProductsGrid.innerHTML = '<p class="text-red-500 text-sm">Error al cargar materiales.</p>';
    }

    // 2. SECONDARY: LOAD STATS (Sales & Income)
    // Wrapped in separate try/catch so it doesn't break the page if it fails
    try {
        console.log("[Profile] Loading creator stats (Secure Query)...");

        // SECURE QUERY: Only fetch orders where I am an author
        // Requires 'author_ids' array in the order document (added in v3.0 checkout)
        const ordersQuery = query(
            collection(db, "orders"),
            where("author_ids", "array-contains", currentUser.uid)
        );

        const ordersSnapshot = await getDocs(ordersQuery);

        let totalSales = 0;
        let totalIncome = 0;

        ordersSnapshot.forEach(orderDoc => {
            const orderData = orderDoc.data();
            // Double check items just to be sure calculation is correct
            if (orderData.items && Array.isArray(orderData.items)) {
                orderData.items.forEach(item => {
                    if (item.autor_id === currentUser.uid) {
                        totalSales++;
                        totalIncome += (Number(item.precio) || 0);
                    }
                });
            }
        });

        console.log(`[Profile] Stats loaded: ${totalSales} sales, $${totalIncome}`);

        // Update UI
        ui.statSales.textContent = totalSales;

        // Format Income
        if (window.utils && window.utils.formatCurrency) {
            ui.statIncome.textContent = window.utils.formatCurrency(totalIncome);
        } else {
            ui.statIncome.textContent = `$ ${totalIncome.toLocaleString('es-CO')} COP`;
        }

    } catch (error) {
        console.warn("Error loading stats (likely permission or indexing issue):", error);
        // Do not alert user, just leave stats at 0 or previous value
    }
}

/**
 * Render creator's products mini-grid
 */
/**
 * Render creator's products mini-grid
 */
function renderCreatorProducts(products) {
    ui.creatorProductsGrid.innerHTML = products.map(p => {
        const img = p.imagenes_preview?.[0] || 'https://via.placeholder.com/150?text=No+Image';
        const price = p.es_gratis ? 'GRATIS' : `$${p.precio}`;
        const priceClass = p.es_gratis ? 'text-accent' : 'text-slate-900';

        // Use a div instead of 'a' tag to prevent navigation
        // Add cursor-pointer and onclick handled via delegation or direct assignment below
        return `
            <div data-product-id="${p.id}" class="product-mini-card bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex group cursor-pointer hover:border-primary transition-colors">
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
            </div>
        `;
    }).join('');

    // Add click listeners
    const cards = ui.creatorProductsGrid.querySelectorAll('.product-mini-card');
    cards.forEach(card => {
        card.onclick = () => {
            const pid = card.getAttribute('data-product-id');
            const product = products.find(p => p.id === pid);
            if (product) {
                ProductModal.open(product);
            }
        };
    });
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

    // Avatar Upload Interaction
    ui.btnEditAvatar.addEventListener('click', () => {
        ui.fileAvatar.click();
    });

    ui.fileAvatar.addEventListener('change', handleAvatarUpload);

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
        ui.editTwitter.value = userData?.socialLinks?.twitter || '';
        ui.editYoutube.value = userData?.socialLinks?.youtube || '';
        ui.editTiktok.value = userData?.socialLinks?.tiktok || '';
        ui.editWebsite.value = userData?.socialLinks?.website || '';
    } else {
        ui.editSocialContainer.classList.add('hidden');
    }

    // Show modal with animation
    ui.editProfileModal.classList.remove('hidden');

    // STRICT SCROLL LOCK
    // Lock both body and html to ensure no background scrolling occurs
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; // Prevent touch interactions on body

    setTimeout(() => {
        ui.editModalPanel.classList.remove('scale-95', 'opacity-0');
        ui.editModalPanel.classList.add('scale-100', 'opacity-100');
    }, 10);
}

/**
 * Close the edit profile modal
 */
function closeEditModal() {
    ui.editModalPanel.classList.add('scale-95', 'opacity-0');
    ui.editModalPanel.classList.remove('scale-100', 'opacity-100');

    setTimeout(() => {
        ui.editProfileModal.classList.add('hidden');

        // RELEASE SCROLL LOCK
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.touchAction = '';

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
                twitter: ui.editTwitter.value.trim() || null,
                youtube: ui.editYoutube.value.trim() || null,
                tiktok: ui.editTiktok.value.trim() || null,
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

/**
 * Handle Avatar Upload
 */
async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type and size
    if (!file.type.match('image.*')) {
        showError("Por favor selecciona una imagen válida (JPG, PNG, WEBP)");
        return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        showError("La imagen no debe pesar más de 2MB");
        return;
    }

    // Show loading UI
    ui.avatarLoading.classList.remove('hidden');
    ui.profileAvatar.classList.add('opacity-50');

    try {
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const fileName = `avatar_${timestamp}.${extension}`;
        const storageRef = ref(storage, `users/${currentUser.uid}/${fileName}`);

        // Upload
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update Firestore
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            photoURL: downloadURL,
            updatedAt: new Date()
        });

        // Update Auth Profile (if possible)
        try {
            await updateProfile(currentUser, {
                photoURL: downloadURL
            });
        } catch (authErr) {
            console.warn("Auth profile update warning:", authErr);
        }

        // Update UI
        ui.profileAvatar.src = downloadURL;
        if (userData) userData.photoURL = downloadURL; // Update local state

        showSuccess("Foto de perfil actualizada correctamente");

    } catch (error) {
        console.error("Error uploading avatar:", error);
        showError("Error al subir la imagen. Inténtalo de nuevo.");
    } finally {
        // Reset loading UI
        ui.avatarLoading.classList.add('hidden');
        ui.profileAvatar.classList.remove('opacity-50');
        ui.fileAvatar.value = ''; // Reset input
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

/**
 * Configure Share Button Event
 */
function setupShareEvent(uid) {
    if (!ui.btnShareProfile || !uid) return;

    // Remove previous listeners to avoid duplicates (cloning)
    const newBtn = ui.btnShareProfile.cloneNode(true);
    ui.btnShareProfile.parentNode.replaceChild(newBtn, ui.btnShareProfile);
    ui.btnShareProfile = newBtn; // Update reference

    ui.btnShareProfile.onclick = () => {
        const nameToShare = ui.profileName.textContent.trim();
        const url = `${window.location.origin}/panel/perfil.html?uid=${uid}`; // Deep Link Source of Truth

        if (window.utils && window.utils.shareContent) {
            window.utils.shareContent({
                title: `Perfil de ${nameToShare}`,
                text: `¡Mira el perfil de ${nameToShare} en English To Go!`,
                url: url
            });
        }
    };
}

// ========================================
// SECURITY VALIDATION FUNCTION
// ========================================

/**
 * Runtime security check to ensure stats are truly hidden in public view
 * This catches any CSS overrides or timing issues
 */
function validateStatsHiddenInPublicView() {
    if (!isPublicView || !ui.creatorStats) return;

    const computed = window.getComputedStyle(ui.creatorStats);
    const isVisible = computed.display !== 'none' || computed.visibility !== 'hidden';

    console.log('[PRIVACY CHECK]', {
        isPublicView,
        statsElement: ui.creatorStats,
        hasHiddenClass: ui.creatorStats.classList.contains('hidden'),
        computedDisplay: computed.display,
        computedVisibility: computed.visibility,
        hasHiddenAttr: ui.creatorStats.hasAttribute('hidden'),
        inlineDisplay: ui.creatorStats.style.display
    });

    if (isVisible) {
        console.error('🚨 [SECURITY ALERT] Stats are visible in public view! Force hiding...');
        // Emergency failsafe
        ui.creatorStats.style.display = 'none';
        ui.creatorStats.style.visibility = 'hidden';
        ui.creatorStats.classList.add('hidden');
        ui.creatorStats.setAttribute('hidden', 'true');
    } else {
        console.log('✅ [PRIVACY] Stats successfully hidden in public view');
    }
}

// ========================================
// 7. SIDEBAR LOGIC (Ported from Catalogo)
// ========================================

async function initSidebar() {
    // 1. Setup Toggle Events
    window.addEventListener('toggle-sidebar', () => toggleSidebar());
    if (ui.mobileOverlay) ui.mobileOverlay.onclick = () => toggleSidebar(false);

    // 2. Setup Search
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

    // 3. Update CTA visibility
    updateCreatorCta();

    // 4. Fetch Teachers
    await fetchTeachers();
}

function toggleSidebar(forceState) {
    const sidebar = ui.sidebar;
    const overlay = ui.mobileOverlay;
    if (!sidebar) return;

    // Desktop Logic (>= 1024px)
    if (window.innerWidth >= 1024) {
        const isCollapsed = sidebar.classList.contains('collapsed');
        // If forceState is undefined, we toggle. 
        // If currently collapsed (true), we want to open (true).
        // If currently open (false), we want to close (false).
        const shouldBeOpen = forceState !== undefined ? forceState : isCollapsed;

        if (shouldBeOpen) {
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.add('collapsed');
        }

    } else {
        // Mobile Logic (< 1024px)
        const isOpen = sidebar.classList.contains('mobile-open');
        const shouldBeOpen = forceState !== undefined ? forceState : !isOpen;

        if (shouldBeOpen) {
            sidebar.classList.add('mobile-open');
            sidebar.classList.remove('hidden'); // Ensure visible

            overlay.classList.remove('hidden');
            overlay.classList.remove('pointer-events-none'); // Enable clicks

            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('mobile-open');

            overlay.classList.add('opacity-0');

            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.add('pointer-events-none'); // Disable clicks
            }, 300);

            document.body.style.overflow = '';
        }
    }
}

function updateCreatorCta() {
    if (!ui.creatorCta) return;

    // Logic: user logged in + NOT teacher -> Show CTA
    // This runs after auth state is determined
    if (currentUser && !isCreator) {
        ui.creatorCta.classList.remove('hidden');
    } else {
        ui.creatorCta.classList.add('hidden');
    }
}

async function fetchTeachers() {
    if (!ui.teachersList) return;
    try {
        const q = query(collection(db, "users"), where("roles.teacher", "==", true));
        const snapshot = await getDocs(q);

        ui.teachersList.innerHTML = '';
        allTeachers = [];

        // "All Materials" Link (Back to Catalogo)
        const allBtn = document.createElement('div');
        allBtn.className = `teacher-item cursor-pointer rounded-lg p-2 flex items-center gap-3 transition-colors hover:bg-slate-50 border border-transparent`;
        allBtn.setAttribute('data-name', 'todos all english to go');
        allBtn.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <i class="fa-solid fa-layer-group text-xs"></i>
            </div>
            <div class="flex flex-col">
                <span class="text-xs font-bold text-slate-700">Ver Todo</span>
                <span class="text-[9px] text-slate-400">Ir al Catálogo</span>
            </div>
        `;
        allBtn.onclick = () => window.location.href = '../catalogo.html';
        ui.teachersList.appendChild(allBtn);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const realTeacherId = data.uid || docSnap.id;

            // Cache for search
            allTeachers.push({
                uid: realTeacherId,
                displayName: data.displayName || 'Profesor',
                photoURL: data.photoURL || 'https://i.imgur.com/O1F7GGy.png',
                _searchString: (data.displayName || '').toLowerCase()
            });

            const isActive = profileUid === realTeacherId;

            // Render Item
            const row = document.createElement('div');
            row.className = `teacher-item cursor-pointer rounded-lg p-2 flex items-center justify-between transition-colors group ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`;
            row.setAttribute('data-name', (data.displayName || 'profesor').toLowerCase());

            const left = document.createElement('div');
            left.className = "flex items-center gap-3 flex-1 min-w-0";
            left.innerHTML = `
                <img src="${data.photoURL || 'https://i.imgur.com/O1F7GGy.png'}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
                <div class="flex flex-col overflow-hidden">
                    <span class="text-xs font-bold truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}">
                        ${data.displayName || 'Profesor'}
                    </span>
                    ${isActive ? '<span class="text-[9px] text-indigo-500 font-medium">Viendo ahora</span>' : ''}
                </div>
            `;

            // Row click -> Navigate to that profile
            row.onclick = () => {
                window.location.href = `perfil.html?uid=${realTeacherId}`;
            };

            row.appendChild(left);
            ui.teachersList.appendChild(row);
        });

    } catch (e) {
        console.error("Error fetching teachers for sidebar:", e);
        if (ui.teachersList) ui.teachersList.innerHTML = '<div class="text-xs text-red-400 p-2">Error cargando lista.</div>';
    }
}
