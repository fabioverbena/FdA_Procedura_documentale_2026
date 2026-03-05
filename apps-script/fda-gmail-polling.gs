/**
 * ========================================
 * APPS SCRIPT - POLLING GMAIL FDA
 * ========================================
 * 
 * Gira sull'account Google di FdA.
 * Ogni 6 ore:
 * 1. Cerca email YouSign con PDF firmati
 * 2. Scarica PDF allegati
 * 3. Salva in cartella "Firmati" del cliente
 * 4. Aggiorna Sheet con path PDF
 * 5. Marca email come processata
 * 
 * SETUP:
 * - Crea progetto Apps Script legato allo Sheet FdA
 * - Copia questo codice
 * - Configura trigger: ogni 6 ore
 * - Autorizza accessi Gmail + Drive + Sheets
 */

// ==========================================
// CONFIGURAZIONE
// ==========================================

const CONFIG = {
  // ID dello Sheet FdA (quello su account FdA)
  SPREADSHEET_ID: '1_CZj56b-FQxgfKM0uYGrRy65cLUPkbTL_3rwoRQytBE',
  
  // ID cartella root "Clienti" su Drive FdA
  ROOT_CLIENTI_FOLDER_ID: '1sGDEksehPRFFlXfUanoaSmS5QTxSOVxX',
  
  // Query Gmail per trovare email YouSign
  GMAIL_QUERY: 'from:noreply@yousign.com subject:"signed" has:attachment filename:pdf',
  
  // Label Gmail per marcare email processate
  PROCESSED_LABEL: 'YouSign/Processed',
  
  // Indici colonne Sheet (0-based)
  COL_ID: 0,
  COL_NOME_AZIENDA: 3,
  COL_CLIENT_FOLDER_ID: 17,
  COL_FIRMATI_FOLDER_ID: 19,
  COL_PDF_URL: 16,
};

// ==========================================
// FUNZIONE PRINCIPALE (trigger ogni 6h)
// ==========================================

function processYouSignEmails() {
  Logger.log('🔄 Inizio polling email YouSign...');
  
  try {
    // 1. Cerca email YouSign non processate
    const threads = GmailApp.search(CONFIG.GMAIL_QUERY + ' -label:' + CONFIG.PROCESSED_LABEL, 0, 50);
    Logger.log(`📧 Trovate ${threads.length} email da processare`);
    
    if (threads.length === 0) {
      Logger.log('✅ Nessuna nuova email YouSign');
      return;
    }
    
    // 2. Ottieni o crea label "Processed"
    const processedLabel = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
    
    // 3. Carica Sheet
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // 4. Processa ogni thread
    let processed = 0;
    let errors = 0;
    
    for (const thread of threads) {
      try {
        const messages = thread.getMessages();
        for (const message of messages) {
          const result = processMessage(message, data, sheet);
          if (result) processed++;
        }
        // Marca thread come processato
        thread.addLabel(processedLabel);
      } catch (e) {
        Logger.log(`❌ Errore thread ${thread.getId()}: ${e.message}`);
        errors++;
      }
    }
    
    Logger.log(`✅ Processate ${processed} email, ${errors} errori`);
    
  } catch (error) {
    Logger.log(`❌ Errore generale: ${error.message}`);
    Logger.log(error.stack);
  }
}

// ==========================================
// PROCESSA SINGOLA EMAIL
// ==========================================

function processMessage(message, sheetData, sheet) {
  const subject = message.getSubject();
  const body = message.getPlainBody();
  
  Logger.log(`📨 Processo email: ${subject}`);
  
  // 1. Estrai info dal subject/body
  // Esempio subject: "Document signed: Contratto Leo2 - AZIENDA XYZ"
  // Esempio body contiene: "Order ID: fda-123456..."
  
  const orderIdMatch = body.match(/Order ID[:\s]+([a-z0-9\-]+)/i) || 
                       subject.match(/ID[:\s]+([a-z0-9\-]+)/i);
  
  if (!orderIdMatch) {
    Logger.log('⚠️ Nessun Order ID trovato nell\'email');
    return false;
  }
  
  const orderId = orderIdMatch[1];
  Logger.log(`🔍 Order ID: ${orderId}`);
  
  // 2. Trova ordine nello Sheet
  const orderRow = findOrderRow(orderId, sheetData);
  if (!orderRow) {
    Logger.log(`⚠️ Ordine ${orderId} non trovato nello Sheet`);
    return false;
  }
  
  const nomeAzienda = orderRow.data[CONFIG.COL_NOME_AZIENDA];
  const clientFolderId = orderRow.data[CONFIG.COL_CLIENT_FOLDER_ID];
  const firmatiFolderId = orderRow.data[CONFIG.COL_FIRMATI_FOLDER_ID];
  
  Logger.log(`📁 Cliente: ${nomeAzienda}`);
  
  // 3. Assicura esistenza cartella "Firmati"
  let firmatiFolder;
  if (firmatiFolderId) {
    try {
      firmatiFolder = DriveApp.getFolderById(firmatiFolderId);
    } catch {
      firmatiFolder = null;
    }
  }
  
  if (!firmatiFolder && clientFolderId) {
    try {
      const clientFolder = DriveApp.getFolderById(clientFolderId);
      firmatiFolder = getOrCreateSubfolder(clientFolder, 'Firmati');
      // Aggiorna Sheet con ID cartella Firmati
      sheet.getRange(orderRow.index + 1, CONFIG.COL_FIRMATI_FOLDER_ID + 1).setValue(firmatiFolder.getId());
    } catch (e) {
      Logger.log(`❌ Errore creazione cartella Firmati: ${e.message}`);
    }
  }
  
  if (!firmatiFolder) {
    Logger.log('⚠️ Impossibile trovare/creare cartella Firmati');
    return false;
  }
  
  // 4. Scarica PDF allegati
  const attachments = message.getAttachments();
  let savedPdfUrl = null;
  
  for (const attachment of attachments) {
    if (attachment.getContentType() === 'application/pdf') {
      const filename = attachment.getName();
      Logger.log(`📄 Salvo PDF: ${filename}`);
      
      try {
        // Salva in Drive
        const file = firmatiFolder.createFile(attachment);
        file.setName(filename);
        savedPdfUrl = file.getUrl();
        Logger.log(`✅ PDF salvato: ${savedPdfUrl}`);
      } catch (e) {
        Logger.log(`❌ Errore salvataggio PDF: ${e.message}`);
      }
    }
  }
  
  // 5. Aggiorna Sheet con URL PDF
  if (savedPdfUrl) {
    sheet.getRange(orderRow.index + 1, CONFIG.COL_PDF_URL + 1).setValue(savedPdfUrl);
    Logger.log(`✅ Sheet aggiornato per ordine ${orderId}`);
    return true;
  }
  
  return false;
}

// ==========================================
// HELPER: TROVA ORDINE NELLO SHEET
// ==========================================

function findOrderRow(orderId, sheetData) {
  for (let i = 1; i < sheetData.length; i++) { // Skip header
    const row = sheetData[i];
    if (row[CONFIG.COL_ID] === orderId) {
      return { index: i, data: row };
    }
  }
  return null;
}

// ==========================================
// HELPER: OTTIENI O CREA LABEL GMAIL
// ==========================================

function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    // Crea label (supporta nested con "/")
    const parts = labelName.split('/');
    let currentLabel = null;
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = GmailApp.getUserLabelByName(currentPath);
      if (existing) {
        currentLabel = existing;
      } else {
        currentLabel = GmailApp.createLabel(currentPath);
      }
    }
    label = currentLabel;
  }
  return label;
}

// ==========================================
// HELPER: OTTIENI O CREA SOTTOCARTELLA
// ==========================================

function getOrCreateSubfolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

// ==========================================
// FUNZIONE TEST MANUALE
// ==========================================

function testPolling() {
  Logger.log('🧪 Test manuale polling...');
  processYouSignEmails();
}
