/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getStorage } = require("firebase-admin/storage");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.getDownloadUrl = onCall({ cors: true }, async (request) => {
    // 1. Verify Authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión para descargar archivos.');
    }

    const productId = request.data.productId;
    if (!productId) {
        throw new HttpsError('invalid-argument', 'El ID del producto es obligatorio.');
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    try {
        // 2. Traer el producto
        const productSnap = await db.collection("products").doc(productId).get();
        if (!productSnap.exists) {
            throw new HttpsError('not-found', 'El producto solicitado no existe.');
        }

        const productData = productSnap.data();

        // Verificar que realmente sea descargable y tenga un archivo
        if (productData.tipo_entrega !== 'file' || !productData.url_archivo) {
            throw new HttpsError('failed-precondition', 'Este producto no es un archivo descargable o no tiene URL.');
        }

        // 3. Verificar Autorización
        // a) Es el creador?
        let hasAccess = productData.creador_uid === uid;

        // b) O es una compra completada por el usuario?
        if (!hasAccess) {
            const ordersSnapshot = await db.collection("orders")
                .where("user_id", "==", uid)
                .where("status", "==", "completed")
                .get();

            for (const doc of ordersSnapshot.docs) {
                const orderData = doc.data();
                if (orderData.items && Array.isArray(orderData.items)) {
                    if (orderData.items.some(item => item.id === productId)) {
                        hasAccess = true;
                        break;
                    }
                }
            }
        }

        if (!hasAccess) {
            throw new HttpsError('permission-denied', 'No tienes acceso a este archivo. Asegúrate de haber completado la compra.');
        }

        // 4. Extraer el path del Storage bucket a partir de la url_archivo pública
        const fileUrl = productData.url_archivo;
        if (!fileUrl.includes('/o/')) {
            throw new HttpsError('internal', 'URL de archivo malformada en la base de datos.');
        }

        let filePath = fileUrl.split('/o/')[1];
        filePath = filePath.split('?')[0]; // quitar parametros
        filePath = decodeURIComponent(filePath); // convertir %2F a /

        // 5. Generar la Signed URL
        const bucket = getStorage().bucket(); // Usa el default del proyecto
        const fileRef = bucket.file(filePath);

        // Expiración: 1 hora
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 1);

        const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: expirationDate,
        });

        return {
            url: signedUrl
        };

    } catch (error) {
        console.error("Error generating Signed URL:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Error interno al generar el enlace de descarga.');
    }
});
