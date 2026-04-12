import { Order, OrderStatus, AppConfig, ContractType, ModelType, ConditionType, getCurrentStep, getStepDescription } from "../types";
import { getToken } from "./googleAuth";

const STORAGE_KEY = 'fda_orders_2026';
const CONFIG_KEY = 'fda_config_2026';

const DEFAULT_CONFIG: AppConfig = {
  rootFolderId: '',
  templateContrattoId: '',
  templateManualeId: '',
  templateGaranziaId: '',
  spreadsheetId: '',
  logoUrl: ''
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
    return data ? JSON.parse(data) : DEFAULT_CONFIG;
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
    status: row[16] as OrderStatus || OrderStatus.IN_CORSO,  // ✅ Colonna Q (index 16)
    pdfUrl: row[17] || '',           // 🆕 Colonna R
    clientFolderId: row[18] || '',   // 🆕 Colonna S
    firmatiFolderId: row[19] || '',  // 🆕 Colonna T
    workflow: {
      contrattoInviato: row[20] === 'TRUE' || row[20] === true,  // ✅ Colonna U
      contrattoFirmato: row[21] === 'TRUE' || row[21] === true,  // ✅ Colonna V
      manualeInviato: row[22] === 'TRUE' || row[22] === true,    // ✅ Colonna W
      manualeFirmato: row[23] === 'TRUE' || row[23] === true,    // ✅ Colonna X
      garanziaRilasciata: row[24] === 'TRUE' || row[24] === true // ✅ Colonna Y
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
    return getOrdersFromLocalStorage();
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
    saveOrderToLocalStorage(order);
  } catch (error) {
    console.error('Errore salvataggio su Sheets, fallback a localStorage:', error);
    saveOrderToLocalStorage(order);
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
    
    deleteOrderFromLocalStorage(id);
  } catch (error) {
    console.error('Errore eliminazione da Sheets:', error);
    deleteOrderFromLocalStorage(id);
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
// ENDPOINT EQUIVALENTI: avvia / stato / avanza
// ==========================================

// POST /api/procedure/[id]/avvia
// Imposta status = IN_CORSO (col 17)
export const avviaProcedura = async (id: string): Promise<{ ok: boolean; status: OrderStatus }> => {
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error(`Procedura ${id} non trovata`);

  order.status = OrderStatus.IN_CORSO;
  await saveOrder(order);
  return { ok: true, status: order.status };
};

// GET /api/procedure/[id]/stato
// Legge status (col 17) + workflow (col 21-25)
export const getStatoProcedura = async (id: string): Promise<{
  status: OrderStatus;
  step: number;
  stepDescription: string;
  workflow: Order['workflow'];
} | null> => {
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) return null;

  const step = getCurrentStep(order.workflow);
  return {
    status: order.status,
    step,
    stepDescription: getStepDescription(step),
    workflow: order.workflow
  };
};

// POST /api/procedure/[id]/avanza
// Avanza al prossimo step del workflow aggiornando la colonna corrispondente:
//   step 1 → col 21 contrattoInviato = true
//   step 2 → col 22 contrattoFirmato = true
//   step 3 → col 23 manualeInviato   = true
//   step 4 → col 24 manualeFirmato   = true
//   step 5 → col 25 garanziaRilasciata = true + status = CONCLUSO (col 17)
export const avanzaProcedura = async (id: string): Promise<{
  ok: boolean;
  stepAvanzato: number;
  stepCorrente: number;
  status: OrderStatus;
  workflow: Order['workflow'];
}> => {
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error(`Procedura ${id} non trovata`);

  const stepPrima = getCurrentStep(order.workflow);
  if (stepPrima >= 6) {
    return {
      ok: false,
      stepAvanzato: 0,
      stepCorrente: stepPrima,
      status: order.status,
      workflow: order.workflow
    };
  }

  const w = { ...order.workflow };
  switch (stepPrima) {
    case 1: w.contrattoInviato = true; break;   // col 21
    case 2: w.contrattoFirmato = true; break;   // col 22
    case 3: w.manualeInviato = true; break;     // col 23
    case 4: w.manualeFirmato = true; break;     // col 24
    case 5:
      w.garanziaRilasciata = true;              // col 25
      order.status = OrderStatus.CONCLUSO;      // col 17
      break;
  }

  order.workflow = w;
  await saveOrder(order);

  return {
    ok: true,
    stepAvanzato: stepPrima,
    stepCorrente: getCurrentStep(w),
    status: order.status,
    workflow: w
  };
};

// ==========================================
// FALLBACK: localStorage operations
// ==========================================
const getOrdersFromLocalStorage = (): Order[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveOrderToLocalStorage = (order: Order): void => {
  const orders = getOrdersFromLocalStorage();
  const index = orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    orders[index] = { ...order };
  } else {
    orders.push({ ...order });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

const deleteOrderFromLocalStorage = (id: string): void => {
  const orders = getOrdersFromLocalStorage().filter(o => o.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
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
