
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
    contrattoInviato: boolean;
    contrattoFirmato: boolean;
    manualeInviato: boolean;
    manualeFirmato: boolean;
    garanziaRilasciata: boolean;
  };
}

export interface DashboardStats {
  total: number;
  sospesi: number;
  conclusi: number;
  inCorso: number;
}
