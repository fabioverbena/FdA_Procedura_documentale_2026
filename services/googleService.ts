import { Order, OrderStatus, AppConfig, ContractType, ModelType, ConditionType } from "../types";
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
    order.id,
    order.dataInserimento,
    order.tipoContratto,
    order.nomeAzienda,
    order.rappresentanteLegale,
    order.indirizzo,
    order.cap,
    order.citta,
    order.piva,
    order.emailContatto,
    order.modello,
    order.matricola,
    order.condizione,
    order.prezzo,
    order.status,
    order.workflow.contrattoInviato ? 'TRUE' : 'FALSE',
    order.workflow.contrattoFirmato ? 'TRUE' : 'FALSE',
    order.workflow.manualeInviato ? 'TRUE' : 'FALSE',
    order.workflow.manualeFirmato ? 'TRUE' : 'FALSE',
    order.workflow.garanziaRilasciata ? 'TRUE' : 'FALSE'
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
    piva: row[8] || '',
    emailContatto: row[9] || '',
    modello: row[10] as ModelType || ModelType.LEO2,
    matricola: row[11] || '',
    condizione: row[12] as ConditionType || ConditionType.NUOVO,
    prezzo: parseFloat(row[13]) || 0,
    status: row[14] as OrderStatus || OrderStatus.IN_CORSO,
    workflow: {
      contrattoInviato: row[15] === 'TRUE',
      contrattoFirmato: row[16] === 'TRUE',
      manualeInviato: row[17] === 'TRUE',
      manualeFirmato: row[18] === 'TRUE',
      garanziaRilasciata: row[19] === 'TRUE'
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
      `${config.spreadsheetId}/values/A2:T?valueRenderOption=UNFORMATTED_VALUE`
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
        `${config.spreadsheetId}/values/A${rowNumber}:T${rowNumber}?valueInputOption=RAW`,
        {
          method: 'PUT',
          body: JSON.stringify({
            values: [orderToRow(order)]
          })
        }
      );
    } else {
      // INSERT: Aggiungi nuova riga
      await callSheetsAPI(
        `${config.spreadsheetId}/values/A:T:append?valueInputOption=RAW`,
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
