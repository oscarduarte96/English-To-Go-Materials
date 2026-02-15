/**
 * SCRIPT PARA FIX DE HISTORIAL DE VENTAS (Ejecutar en Consola del Navegador)
 * -----------------------------------------------------------------------
 * Instrucciones:
 * 1. Abre tu página web (dashboard.html o portafolio.html) donde firebase esté cargado.
 * 2. Abre la consola (F12 -> Console).
 * 3. Copia y pega todo este código y presiona Enter.
 */

(async () => {
    // Importamos funciones si no están en window (asumiendo que estás en una página modular, esto puede requerir ajustes)
    // Si estás en portafolio.html, 'db' ya debería ser accesible si se expuso, o usamos el sdk global.
    // Hack para acceder a Firestore desde la consola si no está expuesto globalmente:
    // Necesitamos que 'db', 'collection', 'getDocs', 'updateDoc', 'doc' estén disponibles.
    // Si no lo están, este script asume que puedes modificar un archivo JS temporalmente para correrlo.

    console.log("🚀 Iniciando Script de Reparación de Órdenes...");

    // Intentamos importar desde la ruta relativa correcta para /panel/
    let dbModule;
    try {
        dbModule = await import('../assets/js/firebase-app.js');
    } catch (e) {
        console.warn("No se encontró en ../assets, intentando ./assets...");
        dbModule = await import('./assets/js/firebase-app.js');
    }
    const { db } = dbModule;
    const { collection, getDocs, updateDoc, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js');

    const ordersRef = collection(db, "orders");
    const snapshot = await getDocs(ordersRef);

    let fixedCount = 0;
    let errorCount = 0;

    console.log(`🔍 Analizando ${snapshot.size} órdenes...`);

    for (const orderDoc of snapshot.docs) {
        const order = orderDoc.data();
        const orderId = orderDoc.id;

        let needsUpdate = false;
        let newAuthorIds = new Set(order.author_ids || []);
        let newItems = [...(order.items || [])];

        // 1. Revisar si author_ids tiene "unknown" o está vacío
        const hasUnknownAuthor = newAuthorIds.has("unknown") || newAuthorIds.size === 0;

        if (hasUnknownAuthor) {
            console.log(`⚠️ Orden ${orderId} tiene autores desconocidos. Intentando reparar...`);

            // Recorremos items para buscar el autor real en la colección products
            for (let i = 0; i < newItems.length; i++) {
                const item = newItems[i];

                if (!item.autor_id || item.autor_id === 'unknown') {
                    try {
                        // Buscar producto original
                        const prodRef = doc(db, "products", item.id);
                        const prodSnap = await getDoc(prodRef);

                        if (prodSnap.exists()) {
                            const prodData = prodSnap.data();
                            const realAuthorId = prodData.creador_uid || prodData.author_id || prodData.uid;

                            if (realAuthorId) {
                                console.log(`   ✅ Encontrado autor para item "${item.titulo}": ${realAuthorId}`);
                                newItems[i].autor_id = realAuthorId;
                                newAuthorIds.add(realAuthorId);
                                needsUpdate = true;
                            } else {
                                console.warn(`   ❌ Producto ${item.id} existe pero no tiene creador_uid.`);
                            }
                        } else {
                            console.warn(`   ❌ Producto ${item.id} ya no existe en la BD.`);
                        }
                    } catch (e) {
                        console.error(`   Error buscando producto ${item.id}:`, e);
                    }
                } else {
                    // Si el item ya tiene autor, asegurarlo en author_ids
                    newAuthorIds.add(item.autor_id);
                }
            }
        }

        // Limpiar "unknown" de author_ids si logramos recuperar algo
        if (needsUpdate) {
            newAuthorIds.delete("unknown");
            const finalAuthorIds = Array.from(newAuthorIds);

            try {
                const orderRef = doc(db, "orders", orderId);
                await updateDoc(orderRef, {
                    items: newItems,
                    author_ids: finalAuthorIds
                });
                console.log(`💾 Orden ${orderId} ACTUALIZADA exitosamente.`);
                fixedCount++;
            } catch (e) {
                console.error(`❌ Error guardando orden ${orderId}:`, e);
                errorCount++;
            }
        }
    }

    console.log(`\n🎉 FIN DEL PROCESO.`);
    console.log(`✅ Reparadas: ${fixedCount}`);
    console.log(`❌ Errores: ${errorCount}`);

})();
