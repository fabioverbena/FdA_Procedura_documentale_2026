const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Carica .env manualmente (senza dotenv) ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const PDF_FOLDER = process.env.PDF_FOLDER || '';
const PORT = parseInt(process.env.PORT || '7601', 10);
const FDA_TOKEN = process.env.FDA_TOKEN || '';

if (!PDF_FOLDER) {
  console.error('ERRORE: PDF_FOLDER non configurato in .env');
  process.exit(1);
}

if (!fs.existsSync(PDF_FOLDER)) {
  console.error(`ERRORE: Cartella non trovata: ${PDF_FOLDER}`);
  process.exit(1);
}

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-FDA-TOKEN'],
}));

// --- Middleware: verifica token (se configurato) ---
app.use((req, res, next) => {
  if (FDA_TOKEN) {
    const provided = req.headers['x-fda-token'] || '';
    if (provided !== FDA_TOKEN) {
      return res.status(401).json({ error: 'Token non valido' });
    }
  }
  next();
});

// --- Mappa id -> filepath (hash stabile del path relativo) ---
function fileId(relPath) {
  return crypto.createHash('md5').update(relPath).digest('hex').slice(0, 12);
}

function scanPdfFiles() {
  const results = [];

  function walk(dir, prefix) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (e.isFile() && /\.pdf$/i.test(e.name)) {
        try {
          const stat = fs.statSync(full);
          results.push({
            id: fileId(rel),
            filename: e.name,
            relPath: rel,
            fullPath: full,
            mtime: stat.mtimeMs,
            size: stat.size,
          });
        } catch { /* skip */ }
      }
    }
  }

  walk(PDF_FOLDER, '');
  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}

// --- GET /health ---
app.get('/health', (_req, res) => {
  res.json({ ok: true, folder: PDF_FOLDER });
});

// --- GET /recent?limit=5 ---
app.get('/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);
  const all = scanPdfFiles();
  const recent = all.slice(0, limit).map(f => ({
    id: f.id,
    filename: f.filename,
    mtime: new Date(f.mtime).toISOString(),
    size: f.size,
  }));
  res.json({ files: recent, total: all.length });
});

// --- GET /file/:id ---
app.get('/file/:id', (req, res) => {
  const all = scanPdfFiles();
  const found = all.find(f => f.id === req.params.id);
  if (!found) {
    return res.status(404).json({ error: 'File non trovato' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${found.filename}"`);
  fs.createReadStream(found.fullPath).pipe(res);
});

// --- Avvio ---
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[FDA Local PDF Service] Attivo su http://127.0.0.1:${PORT}`);
  console.log(`[FDA Local PDF Service] Cartella PDF: ${PDF_FOLDER}`);
  const count = scanPdfFiles().length;
  console.log(`[FDA Local PDF Service] PDF trovati: ${count}`);
});
