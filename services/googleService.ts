import { Order, OrderStatus, AppConfig, ContractType, ModelType, ConditionType } from "../types";
import { getToken } from "./googleAuth";

const STORAGE_KEY = 'fda_orders_2026';
const CONFIG_KEY = 'fda_config_2026';

const getOrdersStorageKey = (spreadsheetId?: string): string => {
  const id = String(spreadsheetId || '').trim();
  return id ? `${STORAGE_KEY}_${id}` : STORAGE_KEY;
};

const DEFAULT_CONFIG: AppConfig = {
  rootFolderId: '',
  templateContrattoId: '',
  templateAccordoGrenkeId: '',
  templateManualeId: '',
  templateGaranziaId: '',
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '',
  logoUrl: '',
  localPdfServiceUrl: 'http://127.0.0.1:7601'
};

export const generateSafeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return 'fda-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    }
  }
  return 'fda-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

export const getConfig = (): AppConfig => {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    const stored = data ? (JSON.parse(data) as Partial<AppConfig>) : {};

    const envSpreadsheetId = (DEFAULT_CONFIG.spreadsheetId || '').trim();

    return {
      ...DEFAULT_CONFIG,
      ...stored,
      spreadsheetId: envSpreadsheetId || (stored.spreadsheetId || '').trim()
    };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
};

export const saveConfig = (config: AppConfig): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Errore salvataggio config", e);
  }
};

export const getDirectLogoUrl = (url?: string): string => {
  if (!url) return '';
  const cleanUrl = url.trim();
  const driveIdRegex = /(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/;
  const match = cleanUrl.match(driveIdRegex);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  if (cleanUrl.length >= 25 && !cleanUrl.includes('/') && !cleanUrl.includes('.')) {
    return `https://drive.google.com/uc?export=view&id=${cleanUrl}`;
  }
  return cleanUrl;
};

// ==========================================
// CONVERSIONE: Order ↔ Array per Sheets
// ==========================================
const orderToRow = (order: Order): any[] => {
  return [
    order.id,                      // A (0)
    order.dataInserimento,         // B (1)
    order.tipoContratto,           // C (2)
    order.nomeAzienda,             // D (3)
    order.rappresentanteLegale || '', // E (4)
    order.indirizzo,               // F (5)
    order.cap,                     // G (6)
    order.citta,                   // H (7)
    order.provincia || '',         // I (8) 🆕
    order.piva,                    // J (9)
    order.email || order.emailContatto || '', // K (10)
    order.telefono || '',          // L (11) 🆕
    order.modello,                 // M (12)
    order.matricola,               // N (13)
    order.condizione,              // O (14)
    order.prezzo,                  // P (15)
    order.status,                  // Q (16)
    order.pdfUrl || '',            // R (17) 🆕
    order.clientFolderId || '',    // S (18) 🆕
    order.firmatiFolderId || '',   // T (19) 🆕
    order.workflow?.contrattoInviato || false,  // U (20)
    order.workflow?.contrattoFirmato || false,  // V (21)
    order.workflow?.manualeInviato || false,    // W (22)
    order.workflow?.manualeFirmato || false,    // X (23)
    order.workflow?.garanziaRilasciata || false // Y (24)
  ];
};

const rowToOrder = (row: any[]): Order => {
  const statusRaw = (row[16] ?? '') as string;

  const normalizeStatus = (raw: unknown): OrderStatus => {
    const s = String(raw ?? '').trim();
    if (!s) return OrderStatus.IN_CORSO;

    if (/iter\s+concluso/i.test(s)) return OrderStatus.CONCLUSO;
    if (/^\s*sospeso\s*$/i.test(s)) return OrderStatus.SOSPESO;
    if (/^\s*in\s+corso\s*$/i.test(s)) return OrderStatus.IN_CORSO;

    return s as OrderStatus;
  };

  const contrattoInviato = row[20] === 'TRUE' || row[20] === true || /contratto\s+inviato/i.test(statusRaw);
  const contrattoFirmato = row[21] === 'TRUE' || row[21] === true || /contratto\s+firmat/i.test(statusRaw);
  const manualeInviato = row[22] === 'TRUE' || row[22] === true || /manuale\s+inviato/i.test(statusRaw);
  const manualeFirmato = row[23] === 'TRUE' || row[23] === true || /manuale\s+firmat/i.test(statusRaw);
  const garanziaRilasciata = row[24] === 'TRUE' || row[24] === true || /garanzia\s+(rilasciata|inviata|firmat)/i.test(statusRaw);

  return {
    id: row[0] || generateSafeId(),
    dataInserimento: row[1] || new Date().toISOString().split('T')[0],
    tipoContratto: row[2] as ContractType || ContractType.NUOVO,
    nomeAzienda: row[3] || '',
    rappresentanteLegale: row[4] || '',
    indirizzo: row[5] || '',
    cap: row[6] || '',
    citta: row[7] || '',
    provincia: row[8] || '',  // 🆕 AGGIUNGI (colonna I)
    piva: row[9] || '',        // ✅ Spostato da 8 a 9
    email: row[10] || '',      // 🆕 AGGIUNGI (colonna K)
    emailContatto: row[10] || '',  // Oppure row[11] se sono 2 email diverse
    telefono: row[11] || '',   // 🆕 AGGIUNGI (colonna L)
    modello: row[12] as ModelType || ModelType.LEO2,
    matricola: row[13] || '',
    condizione: row[14] as ConditionType || ConditionType.NUOVO,
    prezzo: parseFloat(row[15]) || 0,
    status: normalizeStatus(row[16]),  // ✅ Colonna Q (index 16)
    pdfUrl: row[17] || '',           // 🆕 Colonna R
    clientFolderId: row[18] || '',   // 🆕 Colonna S
    firmatiFolderId: row[19] || '',  // 🆕 Colonna T
    workflow: {
      contrattoInviato,
      contrattoFirmato,
      manualeInviato,
      manualeFirmato,
      garanziaRilasciata
    }
  };
};

// ==========================================
// GOOGLE SHEETS API - Funzioni base
// ==========================================
const callSheetsAPI = async (endpoint: string, options?: RequestInit) => {
  const token = getToken();
  if (!token) {
    throw new Error('Non autenticato. Effettua il login Google.');
  }

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Sheets API Error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
};

// ==========================================
// CRUD OPERATIONS con Google Sheets
// ==========================================

export const getOrders = async (): Promise<Order[]> => {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    console.warn('Spreadsheet ID non configurato. Uso localStorage.');
    return getOrdersFromLocalStorage();
  }

  try {
    const data = await callSheetsAPI(
      `${config.spreadsheetId}/values/A2:Y?valueRenderOption=UNFORMATTED_VALUE`  // ✅
    );

    if (!data.values || data.values.length === 0) {
      return [];
    }

    return data.values.map(rowToOrder);
  } catch (error) {
    console.error('Errore lettura da Sheets, fallback a localStorage:', error);
    return getOrdersFromLocalStorage(config.spreadsheetId);
  }
};

export const saveOrder = async (order: Order): Promise<void> => {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    console.warn('Spreadsheet ID non configurato. Salvo in localStorage.');
    saveOrderToLocalStorage(order);
    return;
  }

  try {
    const orders = await getOrders();
    const existingIndex = orders.findIndex(o => o.id === order.id);
    
    if (existingIndex >= 0) {
      // UPDATE: Aggiorna riga esistente
      const rowNumber = existingIndex + 2; // +2 perché: riga 1 = header, array inizia da 0
      await callSheetsAPI(
        `${config.spreadsheetId}/values/A${rowNumber}:Y${rowNumber}?valueInputOption=RAW`,  // ✅
        {
          method: 'PUT',
          body: JSON.stringify({ values: [orderToRow(order)] })
        }
      );
    } else {
      // INSERT: Aggiungi nuova riga
      await callSheetsAPI(
        `${config.spreadsheetId}/values/A:Y:append?valueInputOption=RAW`,
        {
          method: 'POST',
          body: JSON.stringify({
            values: [orderToRow(order)]
          })
        }
      );
    }
    
    // Aggiorna anche localStorage come backup
    saveOrderToLocalStorage(order, config.spreadsheetId);
  } catch (error) {
    console.error('Errore salvataggio su Sheets, fallback a localStorage:', error);
    saveOrderToLocalStorage(order, config.spreadsheetId);
    throw error;
  }
};

export const deleteOrder = async (id: string): Promise<void> => {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    deleteOrderFromLocalStorage(id);
    return;
  }

  try {
    const orders = await getOrders();
    const index = orders.findIndex(o => o.id === id);
    
    if (index >= 0) {
      const rowNumber = index + 2;
      
      // Elimina riga da Sheets
      await callSheetsAPI(
        `${config.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber
                }
              }
            }]
          })
        }
      );
    }
    
    deleteOrderFromLocalStorage(id, config.spreadsheetId);
  } catch (error) {
    console.error('Errore eliminazione da Sheets:', error);
    deleteOrderFromLocalStorage(id, config.spreadsheetId);
    throw error;
  }
};

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    await saveOrder(order);
  }
};

// ==========================================
// FALLBACK: localStorage operations
// ==========================================
const getOrdersFromLocalStorage = (spreadsheetId?: string): Order[] => {
  try {
    const data = localStorage.getItem(getOrdersStorageKey(spreadsheetId));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveOrderToLocalStorage = (order: Order, spreadsheetId?: string): void => {
  const orders = getOrdersFromLocalStorage(spreadsheetId);
  const index = orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    orders[index] = { ...order };
  } else {
    orders.push({ ...order });
  }
  localStorage.setItem(getOrdersStorageKey(spreadsheetId), JSON.stringify(orders));
};

const deleteOrderFromLocalStorage = (id: string, spreadsheetId?: string): void => {
  const orders = getOrdersFromLocalStorage(spreadsheetId).filter(o => o.id !== id);
  localStorage.setItem(getOrdersStorageKey(spreadsheetId), JSON.stringify(orders));
};

// ==========================================
// SEED TEST DATA
// ==========================================
export const seedTestData = async (): Promise<Order[]> => {
  const aziende = ["Acqua Lux Veneto", "Pure Hydro S.r.l.", "TecnoBlu Impianti", "EcoDose Italia", "IdroSistemi 2026", "Crystal Flow", "AquaService Pro", "H2O Innovazione", "Blue Future", "Nettuno Tech"];
  const modelli = Object.values(ModelType);
  const tipi = Object.values(ContractType);
  
  const testOrders: Order[] = aziende.map((nome, i) => ({
    id: generateSafeId(),
    dataInserimento: new Date(Date.now() - (i * 86400000 * 3)).toISOString().split('T')[0],
    nomeAzienda: nome,
    rappresentanteLegale: i % 2 === 0 ? "Mario Rossi" : "Anna Verdi",
    indirizzo: "Via delle Terme " + (i + 1),
    cap: "35100",
    citta: "Padova",
    piva: "0123456789" + i,
    emailContatto: "cliente" + i + "@esempio.it",
    modello: modelli[i % modelli.length],
    matricola: "SN-F-" + (202600 + i),
    condizione: ConditionType.NUOVO,
    tipoContratto: tipi[i % tipi.length],
    prezzo: 2500 + (i * 100),
    status: i < 3 ? OrderStatus.CONCLUSO : (i < 8 ? OrderStatus.IN_CORSO : OrderStatus.SOSPESO),
    workflow: {
      contrattoInviato: i < 9,
      contrattoFirmato: i < 7,
      manualeInviato: i < 5,
      manualeFirmato: i < 4,
      garanziaRilasciata: i < 3
    }
  }));

  // Salva sia su Sheets che su localStorage
  for (const order of testOrders) {
    await saveOrder(order);
  }

  return testOrders;
};
