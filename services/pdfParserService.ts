// ==========================================
// PDF Parser Service
// Porting da ddt_parser.py (progetto SPEDIZIONI_App)
// Supporta: DDT, Fattura, Preventivo
// ==========================================

export type DocType = 'DDT' | 'FATTURA' | 'PREVENTIVO' | 'SCONOSCIUTO';

export interface ParsedClientData {
  docType: DocType;
  docNumero: string | null;
  docData: string | null;
  nomeAzienda: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  piva: string | null;
  descrizioneArticolo: string | null;
  totaleImponibile: number | null;
  importoTotale: number | null;
}

// --- Normalizzazione testo (come _norm in Python) ---
function norm(s: string): string {
  s = s.replace(/\r/g, '\n');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{2,}/g, '\n');
  return s.trim();
}

// --- Se la riga contiene due volte lo stesso contenuto, prende la parte sinistra ---
function takeLeftIfDuplicated(line: string): string {
  line = line.trim();

  // Caso: separatore con molti spazi
  const parts = line.split(/\s{2,}/);
  if (parts.length >= 2) {
    return parts[0].trim();
  }

  // Caso: duplicazione con singoli spazi (parole ripetute)
  const words = line.split(/\s+/);
  if (words.length >= 2 && words.length % 2 === 0) {
    const n = words.length / 2;
    const left = words.slice(0, n).join(' ');
    const right = words.slice(n).join(' ');
    if (left === right) return left.trim();
  }

  return line;
}

// --- Se la riga contiene due CAP, prende solo la parte prima del secondo ---
function leftOfSecondCap(line: string): string {
  line = line.trim();
  const first = line.match(/\b\d{5}\b/);
  if (!first || first.index === undefined) return line;

  const rest = line.slice(first.index + first[0].length);
  const second = rest.match(/\b\d{5}\b/);
  if (!second || second.index === undefined) return line;

  const cutPos = first.index + first[0].length + second.index;
  return line.slice(0, cutPos).trim();
}

// --- Parser importi EUR ---
function parseEurNumber(raw: string): number | null {
  let s = (raw || '').trim().replace(/\s/g, '');
  if (!s) return null;

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '');
    s = s.replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const val = parseFloat(s);
  return isNaN(val) ? null : val;
}

function extractAllAmountsEur(txt: string): number[] {
  if (!txt) return [];
  const patt = /\b\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})\b|\b\d+(?:,\d{2})\b|\b\d+\.\d{2}\b/g;
  const vals: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = patt.exec(txt)) !== null) {
    const v = parseEurNumber(m[0]);
    if (v !== null) vals.push(v);
  }
  return vals;
}

// --- Detector tipo documento ---
export function detectDocType(text: string): DocType {
  const header = text.split('\n').slice(0, 25).join('\n').toUpperCase();

  if (/PREVENTIVO/i.test(header)) return 'PREVENTIVO';
  if (/FATTURA/i.test(header) || /NOTA\s+DI\s+CREDITO/i.test(header)) return 'FATTURA';
  if (/D\.?D\.?T\.?/i.test(header) || /DOCUMENTO\s+DI\s+TRASPORTO/i.test(header)) return 'DDT';

  return 'SCONOSCIUTO';
}

// --- Parser principale ---
export function parseDocumentText(rawText: string): ParsedClientData {
  const t = norm(rawText);
  const lines = t.split('\n').map(ln => ln.trim()).filter(ln => ln.length > 0);

  const out: ParsedClientData = {
    docType: detectDocType(t),
    docNumero: null,
    docData: null,
    nomeAzienda: null,
    indirizzo: null,
    cap: null,
    citta: null,
    provincia: null,
    piva: null,
    descrizioneArticolo: null,
    totaleImponibile: null,
    importoTotale: null,
  };

  // --- Numero e data DDT ---
  const header = lines.slice(0, 25).join('\n');
  const mDdt = header.match(/D\.D\.T\.\s*consegna\s*n\.\s*([0-9/ ]+)\s*del\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
  if (mDdt) {
    out.docNumero = mDdt[1].replace(/\s+/g, '');
    out.docData = mDdt[2];
  }

  // --- Numero e data Fattura ---
  if (!out.docNumero) {
    const mFatt = header.match(/FATTURA\s*(?:N\.?|NR\.?|NUMERO)?\s*([0-9/\- ]+)\s*del\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    if (mFatt) {
      out.docNumero = mFatt[1].replace(/\s+/g, '');
      out.docData = mFatt[2];
    }
  }

  // --- Numero e data Preventivo ---
  if (!out.docNumero) {
    const mPrev = header.match(/PREVENTIVO\s*(?:N\.?|NR\.?|NUMERO)?\s*([0-9/\- ]+)\s*del\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    if (mPrev) {
      out.docNumero = mPrev[1].replace(/\s+/g, '');
      out.docData = mPrev[2];
    }
  }

  // --- Blocco Destinatario/Destinazione (layout fisso Mexal) ---
  let destIdx: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Destinatario') && lines[i].includes('Destinazione')) {
      destIdx = i;
      break;
    }
  }

  if (destIdx !== null && destIdx + 3 < lines.length) {
    const nomeLine = takeLeftIfDuplicated(lines[destIdx + 1]);
    const indirLine = takeLeftIfDuplicated(lines[destIdx + 2]);
    const capCityLine = leftOfSecondCap(lines[destIdx + 3]);

    out.nomeAzienda = nomeLine;
    out.indirizzo = indirLine;

    // Pattern 1: "35046 BORGO VENETO PD" (CAP città provincia)
    let m3 = capCityLine.match(/^(\d{5})\s+([A-Z' ]+?)\s+([A-Z]{2})$/);
    if (m3) {
      out.cap = m3[1].trim();
      out.citta = m3[2].trim().replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      out.provincia = m3[3].trim();
    } else {
      // Pattern 2: "35046 BORGO VENETO" (senza provincia)
      const m3b = capCityLine.match(/^(\d{5})\s+([A-Z' ]+?)$/);
      if (m3b) {
        out.cap = m3b[1].trim();
        out.citta = m3b[2].trim().replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      }
    }
  }

  // --- Fallback: blocco "Spett.le" / "Cliente" ---
  if (!out.nomeAzienda) {
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (/^(Spett\.?le|Cliente)\s/i.test(ln)) {
        const afterLabel = ln.replace(/^(Spett\.?le|Cliente)\s*/i, '').trim();
        if (afterLabel) {
          out.nomeAzienda = afterLabel;
        } else if (i + 1 < lines.length) {
          out.nomeAzienda = lines[i + 1].trim();
        }
        break;
      }
    }
  }

  // --- P.IVA ---
  const mPiva = t.match(/P\.\s*IVA\s+(IT[0-9A-Z]+)/i);
  if (mPiva) {
    out.piva = mPiva[1].trim();
  }
  // Fallback: solo 11 cifre dopo P.IVA
  if (!out.piva) {
    const mPiva2 = t.match(/P\.\s*IVA\s+(\d{11})/i);
    if (mPiva2) out.piva = mPiva2[1].trim();
  }

  // --- Descrizione articolo (prima riga tabella articoli) ---
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    // Cerca pattern: "CODICE DESCRIZIONE" (es. "FDA-042 POMPA DI CIRCOLAZIONE GRE")
    const mArt = ln.match(/^([A-Z0-9\-]+)\s+(.+?)\s+(?:PZ|KG|MT|NR|CF)/i);
    if (mArt) {
      out.descrizioneArticolo = `${mArt[1]} ${mArt[2]}`.trim();
      break;
    }
  }

  // --- Totale Imponibile (più preciso di "Totale" generico) ---
  const tUpper = t.toUpperCase();
  const mImp = tUpper.match(/TOTALE\s+IMPONIBILE\s+([\d.,\s]+)/i);
  if (mImp) {
    const val = parseEurNumber(mImp[1]);
    if (val !== null) out.totaleImponibile = val;
  }

  // --- Importo totale (fallback generico) ---
  const mTot = tUpper.match(/\bTOTALE\s+FATTURA\s+([\d.,\s]+)/i);
  if (mTot) {
    const val = parseEurNumber(mTot[1]);
    if (val !== null) out.importoTotale = val;
  }
  // Fallback: cerca "TOTALE" + primo importo
  if (out.importoTotale === null) {
    const mTot2 = tUpper.match(/\bTOTALE\b(.{0,80})/);
    if (mTot2) {
      const nearVals = extractAllAmountsEur(mTot2[1]);
      if (nearVals.length > 0) {
        out.importoTotale = Math.max(...nearVals);
      }
    }
  }

  return out;
}
