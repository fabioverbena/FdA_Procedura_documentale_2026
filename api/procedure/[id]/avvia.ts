// POST /api/procedure/:id/avvia
// Imposta status = "In Corso" (col 17 del GSheet)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkBearer } from '../../_lib/auth';
import { avviaProcedura } from '../../_lib/sheetsServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!checkBearer(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Parametro :id mancante' });
  }

  try {
    const result = await avviaProcedura(id);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
