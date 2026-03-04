// ==========================================
// Client per il mini-servizio PDF locale
// Chiama http://127.0.0.1:7601 (o URL configurato)
// ==========================================

import { getConfig } from './googleService';

const FDA_TOKEN = 'fda-local-2026';

function getBaseUrl(): string {
  const config = getConfig();
  return (config.localPdfServiceUrl || 'http://127.0.0.1:7601').replace(/\/+$/, '');
}

function headers(): Record<string, string> {
  return {
    'X-FDA-TOKEN': FDA_TOKEN,
  };
}

export interface LocalPdfFile {
  id: string;
  filename: string;
  mtime: string;
  size: number;
}

// --- Health check ---
export async function checkLocalServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/health`, {
      headers: headers(),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

// --- Lista ultimi PDF ---
export async function getRecentPdfs(limit: number = 5): Promise<LocalPdfFile[]> {
  const res = await fetch(`${getBaseUrl()}/recent?limit=${limit}`, {
    headers: headers(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Errore servizio locale: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

// --- Scarica PDF come ArrayBuffer ---
export async function downloadPdfBytes(fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${getBaseUrl()}/file/${fileId}`, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Errore download PDF: ${res.status}`);
  return res.arrayBuffer();
}

// --- Estrai testo da PDF usando pdfjs-dist ---
let _pdfjsReady = false;

export async function extractTextFromPdfBytes(bytes: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  if (!_pdfjsReady) {
    // Usa worker locale (bundlato da Vite) — più affidabile del CDN
    try {
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
    } catch {
      // Fallback: disabilita worker (funziona comunque, solo più lento)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    _pdfjsReady = true;
  }

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    
    // Ricostruisci il testo preservando i newline in base alla posizione Y
    let lastY = -1;
    const lines: string[] = [];
    let currentLine = '';
    
    for (const item of content.items) {
      const itemAny = item as any;
      const str = itemAny.str || '';
      const y = itemAny.transform?.[5] || 0;
      
      // Se cambia la Y (nuova riga), aggiungi newline
      if (lastY !== -1 && Math.abs(y - lastY) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine += (currentLine && str ? ' ' : '') + str;
      }
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    
    parts.push(lines.join('\n'));
  }

  const fullText = parts.join('\n');
  console.log('📄 TESTO ESTRATTO DAL PDF:\n', fullText.slice(0, 2000));
  return fullText;
}
