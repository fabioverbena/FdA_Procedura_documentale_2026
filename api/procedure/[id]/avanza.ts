// POST /api/procedure/:id/avanza
// Avanza al prossimo step del workflow aggiornando la colonna corrispondente:
//   step 1 → col 21  contrattoInviato  = true
//   step 2 → col 22  contrattoFirmato  = true
//   step 3 → col 23  manualeInviato    = true
//   step 4 → col 24  manualeFirmato    = true
//   step 5 → col 25  garanziaRilasciata = true  +  col 17 status = "Iter Concluso"

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkBearer } from '../../_lib/auth';
import { avanzaProcedura } from '../../_lib/sheetsServer';

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
    const result = await avanzaProcedura(id);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('non trovata') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
}
