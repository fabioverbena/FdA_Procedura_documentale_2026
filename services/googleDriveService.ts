// services/googleDriveService.ts
import { Order } from '../types';
import { getToken } from './googleAuth';

const DRIVE_CONFIG = {
  clientiFolderId: import.meta.env.VITE_GDRIVE_CLIENTI_FOLDER_ID || '',
  templatesFolderId: import.meta.env.VITE_GDRIVE_TEMPLATES_FOLDER_ID || '',
  templates: {
    accordoGrenke: import.meta.env.VITE_GDRIVE_TEMPLATE_ACCORDO_GRENKE_ID || '',
    contrattoB2B: import.meta.env.VITE_GDRIVE_TEMPLATE_CONTRATTO_B2B_ID || '',
    manuale: import.meta.env.VITE_GDRIVE_TEMPLATE_MANUALE_ID || '',
    garanzia: import.meta.env.VITE_GDRIVE_TEMPLATE_GARANZIA_ID || ''
  }
};

type DocumentType = 'contratto' | 'manuale' | 'garanzia';

const getValidToken = (): string | null => {
  const token = getToken();
  
  if (!token) {
    console.error('[ERROR] getValidToken: token non disponibile o scaduto');
    return null;
  }

  return token;
};

const findFolderByName = async (
  folderName: string,
  parentId: string,
  token: string
): Promise<string | null> => {
  try {
    const escapedName = folderName.replace(/'/g, "\\'");
    const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    console.log('[DEBUG] Ricerca cartella:', folderName);
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error('[ERROR] Errore ricerca cartella:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      console.log('[OK] Cartella esistente trovata:', data.files[0].id);
      return data.files[0].id;
    }
    
    console.log('[INFO] Nessuna cartella trovata');
    return null;
  } catch (error) {
    console.error('[ERROR] findFolderByName:', error);
    return null;
  }
};

const createFolder = async (
  folderName: string,
  parentId: string,
  token: string
): Promise<string | null> => {
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    console.log('[OK] Cartella creata:', folderName);
    return data.id;
  } catch (error) {
    console.error('[ERROR] createFolder:', error);
    return null;
  }
};

export const getOrCreateClientFolder = async (
  nomeAzienda: string, 
  piva?: string
): Promise<{ clientFolderId: string; firmatiFolderId: string } | null> => {
  const token = getToken();
  if (!token || !DRIVE_CONFIG.clientiFolderId) return null;

  try {
    const folderName = piva ? `${nomeAzienda} - ${piva}` : nomeAzienda;
    
    let folderId = await findFolderByName(folderName, DRIVE_CONFIG.clientiFolderId, token);
    
    if (!folderId) {
      folderId = await createFolder(folderName, DRIVE_CONFIG.clientiFolderId, token);
    }
if (!folderId) {
  folderId = await createFolder(folderName, DRIVE_CONFIG.clientiFolderId, token);
}

// NUOVO: Crea sottocartella Firmati
let firmatiFolderId = await findFolderByName('Firmati', folderId, token);
if (!firmatiFolderId) {
  firmatiFolderId = await createFolder('Firmati', folderId, token);
}
return { clientFolderId: folderId, firmatiFolderId };
  } catch (error) {
    console.error('[ERROR] getOrCreateClientFolder:', error);
    return null;
  }
};

const copyTemplate = async (
  templateId: string,
  newName: string,
  destinationFolderId: string,
  token: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName,
          parents: [destinationFolderId]
        })
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    console.log('[OK] Template copiato:', newName);
    return data.id;
  } catch (error) {
    console.error('[ERROR] copyTemplate:', error);
    return null;
  }
};

const replaceTextInDocument = async (
  documentId: string,
  replacements: Record<string, string>,
  token: string
): Promise<boolean> => {
  try {
    console.log('🔍 Placeholder da sostituire:', replacements);
    
    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: {
          text: `{{${placeholder}}}`,
          matchCase: false
        },
        replaceText: value || ''
      }
    }));

    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[ERROR] Response status:', response.status);
      console.error('[ERROR] Error details:', errorData);
      return false;
    }

    console.log('[OK] Placeholder sostituiti');
    return true;
  } catch (error) {
    console.error('[ERROR] replaceTextInDocument:', error);
    return false;
  }
};

const exportAsPDF = async (documentId: string, token: string): Promise<Blob | null> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) return null;
    return await response.blob();
  } catch (error) {
    console.error('[ERROR] exportAsPDF:', error);
    return null;
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const uploadFileToDrive = async (
  fileBlob: Blob,
  fileName: string,
  folderId: string
): Promise<string | null> => {
  try {
    const token = getValidToken();
    if (!token) {
      console.error('[ERROR] uploadFileToDrive: token non valido');
      return null;
    }

    const boundary = '-------drive_upload_' + Math.random().toString(36).slice(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/pdf'
    };

    const body = new Blob(
      [
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: application/pdf\r\n\r\n',
        fileBlob,
        closeDelimiter
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    console.log('[INFO] Upload file su Drive:', fileName, 'nella cartella:', folderId);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',  // 🆕 Aggiungi webContentLink
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // ignore json parse error
      }

      console.error('[ERROR] uploadFileToDrive response:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const downloadLink = data.webContentLink || data.webViewLink;  // 🆕 Usa webContentLink

    console.log('[OK] File caricato su Drive. ID:', data.id, 'link:', downloadLink);

    return downloadLink;
  } catch (error) {
    console.error('[ERROR] uploadFileToDrive:', error);
    return null;
  }
};

const prepareReplacements = (order: Order): Record<string, string> => {
  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('it-IT');
  };

  return {
    dataInserimento: formatDate(order.dataInserimento),
    tipoContratto: order.tipoContratto || '',
    nomeAzienda: order.nomeAzienda || '',
    rappresentanteLegale: order.rappresentanteLegale || '',
    indirizzo: order.indirizzo || '',
    cap: order.cap || '',
    citta: order.citta || '',
    piva: order.piva || '',
    modello: order.modello || '',
    matricola: order.matricola || '',
    condizione: order.condizione || '',
    prezzo: order.prezzo ? order.prezzo.toString() : ''
  };
};

const getContractTemplateId = (tipoContratto: string): string => {
  if (tipoContratto.toLowerCase().includes('grenke')) {
    console.log('[INFO] Tipo contratto GRENKE - uso ACCORDO');
    return DRIVE_CONFIG.templates.accordoGrenke;
  }
  console.log('[INFO] Tipo contratto standard - uso B2B');
  return DRIVE_CONFIG.templates.contrattoB2B;
};

const getContractTypeName = (tipoContratto: string): string => {
  if (tipoContratto.toLowerCase().includes('grenke')) {
    return 'ACCORDO DI UTILIZZO';
  }
  return 'CONTRATTO B2B';
};

export const AndgeneratePrintDocument = async (
  order: Order,
  documentType: DocumentType
): Promise<{ base64: string; filename: string } | null> => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato');
  }

  try {
    const clientFolderId = await getOrCreateClientFolder(order.nomeAzienda, order.piva);
    if (!clientFolderId) {
      throw new Error('Impossibile creare cartella cliente');
    }

    const timestamp = new Date().toISOString().split('T')[0];

    let templateId: string;
    let documentName: string;
    
    if (documentType === 'contratto') {
      templateId = getContractTemplateId(order.tipoContratto);
      const contractType = getContractTypeName(order.tipoContratto);
      documentName = `${contractType} - ${order.nomeAzienda} - ${timestamp}`;
    } else if (documentType === 'manuale') {
      templateId = DRIVE_CONFIG.templates.manuale;
      documentName = `Manuale - ${order.nomeAzienda} - ${timestamp}`;
    } else if (documentType === 'garanzia') {
      templateId = DRIVE_CONFIG.templates.garanzia;
      documentName = `GARANZIA_CE - ${order.nomeAzienda} - ${timestamp}`;
    } else {
      throw new Error(`Tipo documento non valido: ${documentType}`);
    }

    if (!templateId) {
      throw new Error(`Template ${documentType} non configurato`);
    }

    console.log('[INFO] Copia template:', documentName);
    const newDocId = await copyTemplate(templateId, documentName, clientFolderId, token);
    if (!newDocId) {
      throw new Error('Errore copia template');
    }

    console.log('[INFO] Attendo 10 secondi per permettere a Google di processare il documento...');
await new Promise(resolve => setTimeout(resolve, 10000));

console.log('[INFO] Sostituzione placeholder...');
const replacements = prepareReplacements(order);
const replaced = await replaceTextInDocument(newDocId, replacements, token);
if (!replaced) {
  console.warn('[WARN] Sostituzione fallita, procedo...');
}

console.log('[INFO] Generazione PDF...');
    console.log('[INFO] Generazione PDF...');
    const pdfBlob = await exportAsPDF(newDocId, token);
    if (!pdfBlob) {
      throw new Error('Errore generazione PDF');
    }

    const base64Data = await blobToBase64(pdfBlob);
    const filename = `${documentName}.pdf`;

    console.log('[OK] Documento generato:', filename);

    return { base64: base64Data, filename: filename };
  } catch (error: any) {
    console.error('[ERROR] generateAndPrintDocument:', error);
    throw error;
  }
};

export const generateAllDocuments = async (
  order: Order
): Promise<Array<{ base64: string; filename: string; type: string }>> => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato');
  }

  console.log('[START] Generazione documenti per:', order.nomeAzienda);

  try {
    const clientFolderId = await getOrCreateClientFolder(order.nomeAzienda, order.piva);
    if (!clientFolderId) {
      throw new Error('Impossibile creare cartella');
    }

    const replacements = prepareReplacements(order);
    const documents: Array<{ base64: string; filename: string; type: string }> = [];
    const timestamp = new Date().toISOString().split('T')[0];

    const contractTemplateId = getContractTemplateId(order.tipoContratto);
    const contractTypeName = getContractTypeName(order.tipoContratto);
    const contractName = `${contractTypeName} - ${order.nomeAzienda} - ${timestamp}`;
    
    console.log('[1/3] Contratto...');
    const contractDocId = await copyTemplate(contractTemplateId, contractName, clientFolderId, token);
    if (!contractDocId) throw new Error('Errore copia contratto');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await replaceTextInDocument(contractDocId, replacements, token);
    const contractPdf = await exportAsPDF(contractDocId, token);
    if (!contractPdf) throw new Error('Errore PDF contratto');
    
    const contractBase64 = await blobToBase64(contractPdf);
    documents.push({
      base64: contractBase64,
      filename: `${contractName}.pdf`,
      type: 'contratto'
    });

    console.log('[2/3] Garanzia...');
    const garanziaName = `GARANZIA_CE - ${order.nomeAzienda} - ${timestamp}`;
    const garanziaDocId = await copyTemplate(DRIVE_CONFIG.templates.garanzia, garanziaName, clientFolderId, token);
    if (!garanziaDocId) throw new Error('Errore copia garanzia');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await replaceTextInDocument(garanziaDocId, replacements, token);
    const garanziaPdf = await exportAsPDF(garanziaDocId, token);
    if (!garanziaPdf) throw new Error('Errore PDF garanzia');
    
    const garanziaBase64 = await blobToBase64(garanziaPdf);
    documents.push({
      base64: garanziaBase64,
      filename: `${garanziaName}.pdf`,
      type: 'garanzia'
    });

    console.log('[3/3] Manuale...');
    const manualeName = `Manuale - ${order.nomeAzienda} - ${timestamp}`;
    const manualeDocId = await copyTemplate(DRIVE_CONFIG.templates.manuale, manualeName, clientFolderId, token);
    if (!manualeDocId) throw new Error('Errore copia manuale');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await replaceTextInDocument(manualeDocId, replacements, token);
    const manualePdf = await exportAsPDF(manualeDocId, token);
    if (!manualePdf) throw new Error('Errore PDF manuale');
    
    const manualeBase64 = await blobToBase64(manualePdf);
    documents.push({
      base64: manualeBase64,
      filename: `${manualeName}.pdf`,
      type: 'manuale'
    });

    console.log('[OK] Tutti i documenti generati!');
    return documents;

  } catch (error: any) {
    console.error('[ERROR] generateAllDocuments:', error);
    throw error;
  }
};
