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
    contrattoCreato: boolean;      // STEP 1: Documento creato e scaricato
    contrattoInviato: boolean;     // STEP 2: Email inviata al cliente
    contrattoFirmato: boolean;     // STEP 3: FLAG manuale - Cliente ha accettato
    
    // STEP 4-6: Manuale
    manualeCreato: boolean;        // STEP 4: Documento creato e scaricato
    manualeInviato: boolean;       // STEP 5: Email inviata al cliente
    manualeFirmato: boolean;       // STEP 6: FLAG manuale - Cliente ha letto/controfirmato
    
    // STEP 7-9: Garanzia
    garanziaCreata: boolean;       // STEP 7: Documento creato e scaricato
    garanziaInviata: boolean;      // STEP 8: Email inviata al cliente
    garanziaRilasciata: boolean;   // STEP 9: Automatico (= garanziaInviata)
  };
}

export interface DashboardStats {
  total: number;
  sospesi: number;
  conclusi: number;
  inCorso: number;
}

// Helper per determinare lo step corrente
export const getCurrentStep = (workflow: Order['workflow']): number => {
  if (!workflow.contrattoCreato) return 1;
  if (!workflow.contrattoInviato) return 2;
  if (!workflow.contrattoFirmato) return 3;
  if (!workflow.manualeCreato) return 4;
  if (!workflow.manualeInviato) return 5;
  if (!workflow.manualeFirmato) return 6;
  if (!workflow.garanziaCreata) return 7;
  if (!workflow.garanziaInviata) return 8;
  return 9; // Concluso
};

// Helper per verificare se un'azione è permessa
export const canPerformAction = (
  workflow: Order['workflow'],
  action: 'create_contratto' | 'send_contratto' | 'create_manuale' | 'send_manuale' | 'create_garanzia' | 'send_garanzia'
): boolean => {
  switch (action) {
    case 'create_contratto':
      return true; // Sempre permesso (primo step)
    
    case 'send_contratto':
      return workflow.contrattoCreato;
    
    case 'create_manuale':
      return workflow.contrattoFirmato; // Richiede conferma contratto
    
    case 'send_manuale':
      return workflow.manualeCreato;
    
    case 'create_garanzia':
      return workflow.manualeFirmato; // Richiede conferma manuale
    
    case 'send_garanzia':
      return workflow.garanziaCreata;
    
    default:
      return false;
  }
};