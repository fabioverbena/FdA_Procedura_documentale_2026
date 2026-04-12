// GET /api/procedure/:id/stato
// Restituisce status (col 17) + workflow (col 21-25) + step corrente

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkBearer } from '../../_lib/auth';
import { getStatoProcedura } from '../../_lib/sheetsServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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
    const result = await getStatoProcedura(id);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('non trovata') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
}
