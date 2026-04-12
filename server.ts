// server.ts
// Express server locale — rimpiazza il runtime Vercel serverless.
// Avvio: npm run server
// Ascolta su http://localhost:3001

import { config } from 'dotenv';
config({ path: '.env.local' }); // carica prima .env.local (Vite convention)
config();                        // fallback su .env

import express, { NextFunction, Request, Response } from 'express';
import { checkBearer } from './api/_lib/auth.ts';
import { avviaProcedura, avanzaProcedura, getStatoProcedura } from './api/_lib/sheetsServer.ts';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Middleware — Bearer token (stesso controllo dei serverless Vercel)
// ---------------------------------------------------------------------------
function requireBearer(req: Request, res: Response, next: NextFunction): void {
  if (!checkBearer(req.headers.authorization)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// POST /api/procedure/:id/avvia
// Imposta status = "In Corso" (col 17 del GSheet)
// ---------------------------------------------------------------------------
app.post('/api/procedure/:id/avvia', requireBearer, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const result = await avviaProcedura(id);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/procedure/:id/stato
// Restituisce status (col 17) + workflow (col 21-25) + step corrente
// ---------------------------------------------------------------------------
app.get('/api/procedure/:id/stato', requireBearer, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const result = await getStatoProcedura(id);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('non trovata') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/procedure/:id/avanza
// Avanza al prossimo step del workflow (col 21→25) e chiude a "Iter Concluso"
// ---------------------------------------------------------------------------
app.post('/api/procedure/:id/avanza', requireBearer, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const result = await avanzaProcedura(id);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('non trovata') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[server] API locale in ascolto su http://localhost:${PORT}`);
  console.log(`[server] Endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/procedure/:id/avvia`);
  console.log(`  GET  http://localhost:${PORT}/api/procedure/:id/stato`);
  console.log(`  POST http://localhost:${PORT}/api/procedure/:id/avanza`);
});
