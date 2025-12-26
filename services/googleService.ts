
import { Order, OrderStatus, AppConfig, ContractType, ModelType, ConditionType } from "../types";

const STORAGE_KEY = 'fda_orders_2026';
const CONFIG_KEY = 'fda_config_2026';
const AUTH_TOKEN_KEY = 'fda_google_token';

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

export const setAuthToken = (token: string) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

export const logoutGoogle = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getOrders = (): Order[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveOrder = async (order: Order): Promise<void> => {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    orders[index] = { ...order };
  } else {
    orders.push({ ...order });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

export const deleteOrder = (id: string): void => {
  const orders = getOrders().filter(o => o.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

export const updateOrderStatus = (id: string, status: OrderStatus): void => {
  const orders = getOrders();
  const orderIndex = orders.findIndex(o => o.id === id);
  if (orderIndex >= 0) {
    orders[orderIndex].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }
};

export const seedTestData = (): Order[] => {
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(testOrders));
  return testOrders;
};
