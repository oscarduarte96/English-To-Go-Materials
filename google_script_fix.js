/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - FIX PARA NO BORRAR DATOS
 * ============================================================================
 * Instrucciones:
 * 1. Copia este código en tu proyecto de Google Apps Script.
 * 2. Asegúrate de que tu script reciba un parámetro 'action' = 'mark_paid'.
 * 3. Este script busca la fila por ID y actualiza SOLO la columna de Estado.
 */

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Ventas"); // O el nombre de tu hoja

        if (data.action === "mark_paid") {
            return markOrderAsPaid(sheet, data.order_id);
        }

        // ... resto de tu lógica ...

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

function markOrderAsPaid(sheet, orderId) {
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // Asumimos que la columna A tiene el ID de la orden (índice 0)
    // y la columna de Estado es la última (ajusta esto según tu hoja)
    const ID_COLUMN_INDEX = 0;
    const STATUS_COLUMN_INDEX = values[0].indexOf("Estado"); // Busca la columna por nombre "Estado"

    if (STATUS_COLUMN_INDEX === -1) {
        throw new Error("No se encontró la columna 'Estado'");
    }

    for (let i = 1; i < values.length; i++) {
        if (String(values[i][ID_COLUMN_INDEX]) === String(orderId)) {
            // Encontramos la fila (i + 1 porque Sheet es 1-based)
            // Actualizamos SOLO esa celda
            sheet.getRange(i + 1, STATUS_COLUMN_INDEX + 1).setValue("PAGADO");

            return ContentService.createTextOutput(JSON.stringify({
                "status": "success",
                "message": "Orden marcada como pagada sin borrar datos."
            })).setMimeType(ContentService.MimeType.JSON);
        }
    }

    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Orden no encontrada" })).setMimeType(ContentService.MimeType.JSON);
}
