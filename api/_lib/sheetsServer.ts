// api/_lib/sheetsServer.ts
// Accesso server-side a Google Sheets tramite Service Account (JWT).
// Replica la logica di services/googleService.ts senza dipendenze browser
// (niente localStorage, niente OAuth browser flow).

import { createSign } from 'node:crypto';
import {
  Order,
  OrderStatus,
  ContractType,
  ModelType,
  ConditionType,
  getCurrentStep,
  getStepDescription,
} from '../../types';

// ==========================================
// SERVICE ACCOUNT AUTH — JWT → Access Token
// ==========================================
let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Riusa il token in cache se ancora valido (1 minuto di margine)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'Configura GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env'
    );
  }

  // Le chiavi private nei .env hanno \n letterali → le convertiamo in newline reali
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Errore auth service account Google: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.value;
}

// ==========================================
// GOOGLE SHEETS API — wrapper base
// ==========================================
async function callSheets(endpoint: string, options?: RequestInit) {
  const token = await getAccessToken();

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Sheets API Error: ${err?.error?.message || res.statusText}`);
  }

  return res.json();
}

// ==========================================
// ROW MAPPING — specchio di googleService.ts
// Col 17 = status (index 16), col 21-25 = workflow (index 20-24)
// ==========================================
function orderToRow(order: Order): unknown[] {
  return [
    order.id,                                         // A  (0)
    order.dataInserimento,                            // B  (1)
    order.tipoContratto,                              // C  (2)
    order.nomeAzienda,                                // D  (3)
    order.rappresentanteLegale || '',                 // E  (4)
    order.indirizzo,                                  // F  (5)
    order.cap,                                        // G  (6)
    order.citta,                                      // H  (7)
    order.provincia || '',                            // I  (8)
    order.piva,                                       // J  (9)
    order.email || order.emailContatto || '',         // K  (10)
    order.telefono || '',                             // L  (11)
    order.modello,                                    // M  (12)
    order.matricola,                                  // N  (13)
    order.condizione,                                 // O  (14)
    order.prezzo,                                     // P  (15)
    order.status,                                     // Q  (16) ← col 17
    order.pdfUrl || '',                               // R  (17)
    order.clientFolderId || '',                       // S  (18)
    order.firmatiFolderId || '',                      // T  (19)
    order.workflow?.contrattoInviato || false,        // U  (20) ← col 21
    order.workflow?.contrattoFirmato || false,        // V  (21) ← col 22
    order.workflow?.manualeInviato || false,          // W  (22) ← col 23
    order.workflow?.manualeFirmato || false,          // X  (23) ← col 24
    order.workflow?.garanziaRilasciata || false,      // Y  (24) ← col 25
  ];
}

function rowToOrder(row: unknown[]): Order {
  const r = row as string[];
  return {
    id: r[0] || '',
    dataInserimento: r[1] || '',
    tipoContratto: (r[2] as ContractType) || ContractType.NUOVO,
    nomeAzienda: r[3] || '',
    rappresentanteLegale: r[4] || '',
    indirizzo: r[5] || '',
    cap: r[6] || '',
    citta: r[7] || '',
    provincia: r[8] || '',
    piva: r[9] || '',
    email: r[10] || '',
    emailContatto: r[10] || '',
    telefono: r[11] || '',
    modello: (r[12] as ModelType) || ModelType.LEO2,
    matricola: r[13] || '',
    condizione: (r[14] as ConditionType) || ConditionType.NUOVO,
    prezzo: parseFloat(r[15]) || 0,
    status: (r[16] as OrderStatus) || OrderStatus.IN_CORSO,
    pdfUrl: r[17] || '',
    clientFolderId: r[18] || '',
    firmatiFolderId: r[19] || '',
    workflow: {
      contrattoInviato: r[20] === 'TRUE' || (r[20] as unknown as boolean) === true,
      contrattoFirmato: r[21] === 'TRUE' || (r[21] as unknown as boolean) === true,
      manualeInviato: r[22] === 'TRUE' || (r[22] as unknown as boolean) === true,
      manualeFirmato: r[23] === 'TRUE' || (r[23] as unknown as boolean) === true,
      garanziaRilasciata: r[24] === 'TRUE' || (r[24] as unknown as boolean) === true,
    },
  };
}

// ==========================================
// CRUD — lettura e scrittura righe
// ==========================================
async function getAllOrders(): Promise<Order[]> {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID non configurato in .env');

  const data = (await callSheets(
    `${spreadsheetId}/values/A2:Y?valueRenderOption=UNFORMATTED_VALUE`
  )) as { values?: unknown[][] };

  if (!data.values || data.values.length === 0) return [];
  return data.values.map(rowToOrder);
}

async function upsertOrder(order: Order, rowIndex: number): Promise<void> {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID non configurato in .env');

  const rowNumber = rowIndex + 2; // +2: riga 1 = header, array 0-indexed
  await callSheets(
    `${spreadsheetId}/values/A${rowNumber}:Y${rowNumber}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [orderToRow(order)] }) }
  );
}

async function findOrder(id: string): Promise<{ order: Order; rowIndex: number }> {
  const orders = await getAllOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index < 0) throw new Error(`Procedura "${id}" non trovata nel foglio`);
  return { order: orders[index], rowIndex: index };
}

// ==========================================
// BUSINESS LOGIC — i 3 endpoint
// ==========================================

/** POST /api/procedure/:id/avvia — imposta status = IN_CORSO (col 17) */
export async function avviaProcedura(id: string) {
  const { order, rowIndex } = await findOrder(id);
  order.status = OrderStatus.IN_CORSO;
  await upsertOrder(order, rowIndex);
  return { ok: true, status: order.status };
}

/** GET /api/procedure/:id/stato — legge status (col 17) + workflow (col 21-25) */
export async function getStatoProcedura(id: string) {
  const { order } = await findOrder(id);
  const step = getCurrentStep(order.workflow);
  return {
    status: order.status,
    step,
    stepDescription: getStepDescription(step),
    workflow: order.workflow,
  };
}

/** POST /api/procedure/:id/avanza — avanza al prossimo step del workflow */
export async function avanzaProcedura(id: string) {
  const { order, rowIndex } = await findOrder(id);
  const stepPrima = getCurrentStep(order.workflow);

  if (stepPrima >= 6) {
    return {
      ok: false,
      messaggio: 'Iter già completato',
      stepAvanzato: 0,
      stepCorrente: stepPrima,
      status: order.status,
      workflow: order.workflow,
    };
  }

  const w = { ...order.workflow };
  switch (stepPrima) {
    case 1: w.contrattoInviato = true; break;   // → col 21
    case 2: w.contrattoFirmato = true; break;   // → col 22
    case 3: w.manualeInviato = true; break;     // → col 23
    case 4: w.manualeFirmato = true; break;     // → col 24
    case 5:
      w.garanziaRilasciata = true;              // → col 25
      order.status = OrderStatus.CONCLUSO;      // → col 17
      break;
  }

  order.workflow = w;
  await upsertOrder(order, rowIndex);

  return {
    ok: true,
    stepAvanzato: stepPrima,
    stepCorrente: getCurrentStep(w),
    status: order.status,
    workflow: w,
  };
}
