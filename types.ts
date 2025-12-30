export enum ContractType {
  GRENKE = 'Grenke',
  NUOVO = 'Nuovo',
  USATO = 'Usato'
}

export enum ModelType {
  LEO2 = 'Leo2',
  LEO3 = 'Leo3',
  LEO4 = 'Leo4',
  LEO5 = 'Leo5',
  TITANO = 'Titano'
}

export enum ConditionType {
  NUOVO = 'Nuovo',
  USATO = 'Usato'
}

export enum OrderStatus {
  IN_CORSO = 'In Corso',
  SOSPESO = 'Sospeso',
  CONCLUSO = 'Iter Concluso'
}

export interface AppConfig {
  rootFolderId: string;
  templateContrattoId: string;
  templateManualeId: string;
  templateGaranziaId: string;
  spreadsheetId: string;
  logoUrl?: string;
}

export interface Order {
  id: string;
  dataInserimento: string;
  tipoContratto: ContractType;
  nomeAzienda: string;
  rappresentanteLegale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  piva: string;
  emailContatto: string;
  modello: ModelType;
  matricola: string;
  condizione: ConditionType;
  prezzo: number;
  status: OrderStatus;
  workflow: {
    // STEP 1-3: Contratto
    contrattoInviato: boolean;     // STEP 2: Email inviata al cliente
    contrattoFirmato: boolean;     // STEP 3: FLAG manuale - Cliente ha accettato
    
    // STEP 4-6: Manuale
    manualeInviato: boolean;       // STEP 5: Email inviata al cliente
    manualeFirmato: boolean;       // STEP 6: FLAG manuale - Cliente ha letto/controfirmato
    
    // STEP 7-9: Garanzia
    garanziaRilasciata: boolean;   // STEP 9: Automatico (= garanziaInviata)
  };
}

export interface DashboardStats {
  total: number;
  sospesi: number;
  conclusi: number;
  inCorso: number;
}

// ==========================================
// HELPER: DETERMINA STEP CORRENTE
// ==========================================
export const getCurrentStep = (workflow: Order['workflow']): number => {
  if (!workflow.contrattoInviato) return 1;
  if (!workflow.contrattoFirmato) return 2;
  if (!workflow.manualeInviato) return 3;
  if (!workflow.manualeFirmato) return 4;
  if (!workflow.garanziaRilasciata) return 5;
  return 6; // Concluso
};

// ==========================================
// HELPER: TESTO DESCRITTIVO DELLO STEP
// ==========================================
export const getStepDescription = (step: number): string => {
  const descriptions: Record<number, string> = {
    1: 'In attesa di invio contratto',
    2: 'Contratto inviato - In attesa firma cliente',
    3: 'Contratto firmato - In attesa invio manuale',
    4: 'Manuale inviato - In attesa firma cliente',
    5: 'Manuale firmato - In attesa rilascio garanzia',
    6: 'Iter completato - Garanzia rilasciata'
  };
  return descriptions[step] || 'Step sconosciuto';
};

// ==========================================
// HELPER: PROGRESSO PERCENTUALE
// ==========================================
export const getProgressPercentage = (workflow: Order['workflow']): number => {
  const currentStep = getCurrentStep(workflow);
  return Math.round((currentStep / 6) * 100);
};

// ==========================================
// HELPER: VERIFICA AZIONI PERMESSE
// ==========================================
export const canPerformAction = (
  workflow: Order['workflow'],
  action: 'send_contratto' | 'send_manuale' | 'send_garanzia'
): boolean => {
  switch (action) {
    case 'send_contratto':
      return true; // Sempre permesso (primo step)
    
    case 'send_manuale':
      return workflow.contrattoFirmato; // Richiede conferma contratto
    
    case 'send_garanzia':
      return workflow.manualeFirmato; // Richiede conferma manuale
    
    default:
      return false;
  }
};

// ==========================================
// HELPER: PROSSIMA AZIONE RACCOMANDATA
// ==========================================
export const getNextAction = (workflow: Order['workflow']): string => {
  if (!workflow.contrattoInviato) return 'Invia Contratto';
  if (!workflow.contrattoFirmato) return 'Attendere firma contratto';
  if (!workflow.manualeInviato) return 'Invia Manuale';
  if (!workflow.manualeFirmato) return 'Attendere conferma manuale';
  if (!workflow.garanziaRilasciata) return 'Invia Garanzia';
  return 'Iter completato';
};

// ==========================================
// HELPER: VALIDAZIONE ORDINE
// ==========================================
export const validateOrder = (order: Partial<Order>): string[] => {
  const errors: string[] = [];

  if (!order.nomeAzienda?.trim()) errors.push('Nome Azienda obbligatorio');
  if (!order.rappresentanteLegale?.trim()) errors.push('Rappresentante Legale obbligatorio');
  if (!order.piva?.trim()) errors.push('P.IVA obbligatoria');
  if (!order.emailContatto?.trim()) errors.push('Email obbligatoria');
  if (!order.modello) errors.push('Modello obbligatorio');
  if (!order.matricola?.trim()) errors.push('Matricola obbligatoria');
  if (!order.prezzo || order.prezzo <= 0) errors.push('Prezzo deve essere maggiore di 0');

  // Validazione formato email
  if (order.emailContatto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.emailContatto)) {
    errors.push('Email non valida');
  }

  return errors;
};