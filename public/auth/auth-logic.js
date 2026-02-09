/* =========================================
   ENGLISH TO GO MATERIALS - AUTH LOGIC
   Controlador central para Login, Registro y Recuperación.
   ========================================= */

// 1. Importamos la configuración central de tu proyecto
import { auth, db } from "../assets/js/firebase-app.js";

// 2. Importamos las funciones oficiales de Firebase Auth y Firestore
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    fetchSignInMethodsForEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * Mapeo de Errores de Firebase a Español
 * Ayuda a que el usuario entienda qué pasó.
 */
function mapAuthError(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use': return "Este correo ya está registrado.";
        case 'auth/invalid-email': return "El correo electrónico no es válido.";
        case 'auth/weak-password': return "La contraseña es muy débil (mínimo 6 caracteres).";
        case 'auth/user-not-found': return "No existe una cuenta con este correo.";
        case 'auth/wrong-password': return "Contraseña incorrecta.";
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials': return "Credenciales incorrectas.";
        case 'auth/too-many-requests': return "Demasiados intentos. Espera unos minutos.";
        case 'auth/popup-closed-by-user': return "Se cerró la ventana de inicio de sesión.";
        case 'auth/network-request-failed': return "Error de conexión. Revisa tu internet.";
        default: return "Ocurrió un error inesperado. Intenta de nuevo.";
    }
}

/**
 * 1. INICIAR SESIÓN (Email/Pass)
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Error Login:", error.code);

        // Generic error handling for invalid credentials
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            return { success: false, error: "Credenciales incorrectas (correo o contraseña).", code: 'auth/invalid-credential' };
        }

        return { success: false, error: mapAuthError(error.code), code: error.code };
    }
}

/**
 * 2. REGISTRAR USUARIO NUEVO
 * Maneja la creación en Auth y el guardado de datos en Firestore.
 */
export async function registerUser({ name, email, password, isTeacher = false, storeName }) {
    try {
        // A. Crear usuario en Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // B. Actualizar el "DisplayName" interno de Firebase
        await updateProfile(user, { displayName: name });

        // C. Preparar datos para Firestore
        const userData = {
            uid: user.uid,
            email: email,
            displayName: name,
            photoURL: "https://i.imgur.com/O1F7GGy.png", // Avatar por defecto
            createdAt: serverTimestamp(),
            roles: {
                student: true, // Siempre es estudiante
                teacher: isTeacher // True si marcó el checkbox
            }
        };

        // Si es profesor, agregamos perfil de vendedor
        if (isTeacher) {
            userData.sellerProfile = {
                storeName: storeName || "Mi Tienda",
                totalSales: 0,
                isActive: true
            };
        }

        // D. Guardar en Base de Datos
        await setDoc(doc(db, "users", user.uid), userData);

        return { success: true, user: user };

    } catch (error) {
        console.error("Error Registro:", error.code);
        return { success: false, error: mapAuthError(error.code), code: error.code };
    }
}

/**
 * 3. LOGIN / REGISTRO CON GOOGLE (Híbrido)
 * Si no existe, lo crea. Si existe, entra.
 */
export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Verificar si ya existe en Firestore para no sobrescribir datos
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // Es nuevo: Crear registro básico
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: serverTimestamp(),
                roles: { student: true, teacher: false }
            });
        }

        return { success: true, user: user };

    } catch (error) {
        console.error("Error Google:", error.code);
        return { success: false, error: mapAuthError(error.code), code: error.code };
    }
}

/**
 * 4. RECUPERAR CONTRASEÑA
 */
export async function recoverPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error("Error Recovery:", error.code);
        return { success: false, error: mapAuthError(error.code) };
    }
}

/**
 * 5. CERRAR SESIÓN
 */
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../auth/login.html';
    } catch (error) {
        console.error("Error Logout:", error);
    }
}