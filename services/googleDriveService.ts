import { Order } from "../types";
import { getToken } from "./googleAuth";
import { getConfig } from "./googleService";

// ==========================================
// GOOGLE DRIVE API - Helper
// ==========================================
const callDriveAPI = async (endpoint: string, options?: RequestInit) => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato. Effettua il login Google.');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Drive API Error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
};

// ==========================================
// CREA CARTELLA CLIENTE
// ==========================================
export const createClientFolder = async (order: Order): Promise<string> => {
  const config = getConfig();
  
  if (!config.rootFolderId) {
    throw new Error('ID Cartella Radice non configurato');
  }

  // Nome cartella: "NomeAzienda - PIVA"
  const folderName = `${order.nomeAzienda} - ${order.piva}`;

  // Verifica se esiste già
  const existing = await callDriveAPI(
    `files?q=name='${folderName}' and '${config.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  if (existing.files && existing.files.length > 0) {
    console.log('Cartella già esistente:', existing.files[0].id);
    return existing.files[0].id;
  }

  // Crea nuova cartella
  const folder = await callDriveAPI('files', {
    method: 'POST',
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [config.rootFolderId]
    })
  });

  console.log('Cartella cliente creata:', folder.id);
  return folder.id;
};

// ==========================================
// SOSTITUISCI SEGNAPOSTI NEL TEMPLATE
// ==========================================
const replacePlaceholders = (text: string, order: Order): string => {
  const replacements: Record<string, string> = {
    '{{NOME_AZIENDA}}': order.nomeAzienda,
    '{{RAPPRESENTANTE_LEGALE}}': order.rappresentanteLegale,
    '{{INDIRIZZO}}': order.indirizzo,
    '{{CAP}}': order.cap,
    '{{CITTA}}': order.citta,
    '{{P_IVA}}': order.piva,
    '{{EMAIL}}': order.emailContatto,
    '{{MODELLO}}': order.modello,
    '{{MATRICOLA}}': order.matricola,
    '{{CONDIZIONE}}': order.condizione,
    '{{PREZZO}}': order.prezzo.toString(),
    '{{DATA}}': order.dataInserimento,
    '{{TIPO_CONTRATTO}}': order.tipoContratto
  };

  let result = text;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replaceAll(placeholder, value);
  });

  return result;
};

// ==========================================
// COPIA E COMPILA TEMPLATE DA GOOGLE DOCS
// ==========================================
export const copyAndFillTemplate = async (
  templateId: string,
  order: Order,
  destinationFolderId: string,
  documentName: string
): Promise<string> => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato');
  }

  // 1. Copia il template
  const copiedFile = await callDriveAPI(`files/${templateId}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      name: documentName,
      parents: [destinationFolderId]
    })
  });

  console.log('Template copiato:', copiedFile.id);

  // 2. Leggi il contenuto del documento copiato
  const docResponse = await fetch(`https://docs.google.com/document/d/${copiedFile.id}/export?format=txt`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!docResponse.ok) {
    throw new Error('Errore lettura documento');
  }

  const originalText = await docResponse.text();

  // 3. Sostituisci i segnaposti
  const updatedText = replacePlaceholders(originalText, order);

  // 4. Aggiorna il documento con Google Docs API
  // Nota: Google Docs API richiede richieste batch complesse
  // Per semplicità, usiamo un approccio con requests batch
  const requests = [];
  
  // Trova e sostituisci ogni segnaposto
  Object.entries({
    '{{NOME_AZIENDA}}': order.nomeAzienda,
    '{{RAPPRESENTANTE_LEGALE}}': order.rappresentanteLegale,
    '{{INDIRIZZO}}': order.indirizzo,
    '{{CAP}}': order.cap,
    '{{CITTA}}': order.citta,
    '{{P_IVA}}': order.piva,
    '{{EMAIL}}': order.emailContatto,
    '{{MODELLO}}': order.modello,
    '{{MATRICOLA}}': order.matricola,
    '{{CONDIZIONE}}': order.condizione,
    '{{PREZZO}}': order.prezzo.toString(),
    '{{DATA}}': order.dataInserimento,
    '{{TIPO_CONTRATTO}}': order.tipoContratto
  }).forEach(([placeholder, value]) => {
    requests.push({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: true
        },
        replaceText: value
      }
    });
  });

  // Applica le sostituzioni
  const docsResponse = await fetch(`https://docs.googleapis.com/v1/documents/${copiedFile.id}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!docsResponse.ok) {
    console.error('Errore aggiornamento documento');
  }

  return copiedFile.id;
};

// ==========================================
// ESPORTA DOCUMENTO COME PDF
// ==========================================
export const exportDocumentAsPdf = async (documentId: string): Promise<Blob> => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato');
  }

  const response = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=pdf`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Errore esportazione PDF');
  }

  return await response.blob();
};

// ==========================================
// DOWNLOAD PDF
// ==========================================
export const downloadPdf = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==========================================
// PROCESSO COMPLETO: GENERA E STAMPA DOCUMENTO
// ==========================================
export const generateAndPrintDocument = async (
  order: Order,
  documentType: 'contratto' | 'manuale' | 'garanzia'
): Promise<void> => {
  const config = getConfig();

  // Seleziona il template corretto
  let templateId: string;
  let documentName: string;

  switch (documentType) {
    case 'contratto':
      templateId = config.templateContrattoId;
      documentName = `Contratto_${order.nomeAzienda}_${order.piva}.pdf`;
      break;
    case 'manuale':
      templateId = config.templateManualeId;
      documentName = `Manuale_${order.modello}_${order.matricola}.pdf`;
      break;
    case 'garanzia':
      templateId = config.templateGaranziaId;
      documentName = `Garanzia_${order.modello}_${order.matricola}.pdf`;
      break;
  }

  if (!templateId) {
    throw new Error(`Template ${documentType} non configurato`);
  }

  // 1. Crea/ottieni cartella cliente
  const clientFolderId = await createClientFolder(order);

  // 2. Copia e compila template
  const documentId = await copyAndFillTemplate(
    templateId,
    order,
    clientFolderId,
    documentName.replace('.pdf', '')
  );

  // 3. Esporta come PDF
  const pdfBlob = await exportDocumentAsPdf(documentId);

  // 4. Download automatico
  downloadPdf(pdfBlob, documentName);

  console.log('Documento generato e scaricato:', documentName);
};