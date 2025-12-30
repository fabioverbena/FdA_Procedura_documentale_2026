import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

// ==========================================
// INIZIALIZZAZIONE CON VITE ENV
// ==========================================
const getApiKey = (): string => {
  // Priorità: variabile Vite > fallback vuoto
  const key = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!key) {
    console.warn('⚠️ GEMINI_API_KEY non configurata. Setta VITE_GEMINI_API_KEY in .env.local');
  }
  
  return key;
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

// ==========================================
// GENERAZIONE EMAIL PROFESSIONALE
// ==========================================
export const generateProfessionalEmail = async (
  order: Order, 
  documentType: 'contratto' | 'manuale' | 'garanzia'
): Promise<string> => {
  
  if (!apiKey) {
    // Fallback a template statico se API Key mancante
    return getFallbackEmail(order, documentType);
  }

  const prompt = `
Sei un assistente professionale dell'azienda Fiordacqua. Scrivi una email formale in italiano per il cliente ${order.nomeAzienda}.

Tipo documento allegato: ${documentType.toUpperCase()}

Dettagli Ordine:
- Data: ${order.dataInserimento}
- Modello: ${order.modello}
- Matricola: ${order.matricola}
- Rappresentante Legale: ${order.rappresentanteLegale}

${documentType === 'contratto' 
  ? 'Chiedi gentilmente al cliente di rispondere alla mail per accettazione formale del contratto allegato.' 
  : ''}
${documentType === 'manuale' 
  ? 'Specifica che il cliente conferma di aver letto e compreso il manuale e che tale documento deve essere controfirmato e restituito, pena il non rilascio della garanzia.' 
  : ''}
${documentType === 'garanzia' 
  ? 'Invia il certificato di garanzia ufficiale per il prodotto acquistato.' 
  : ''}

Il tono deve essere professionale, cortese ed efficiente. Non inventare dati extra. Concludi in modo formale con i saluti.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Modello più aggiornato
      contents: prompt,
    });
    
    const generatedText = response.text || getFallbackEmail(order, documentType);
    return generatedText;
    
  } catch (error: any) {
    console.error("❌ Gemini API Error:", error.message);
    
    // Fallback a template statico in caso di errore
    return getFallbackEmail(order, documentType);
  }
};

// ==========================================
// FALLBACK: TEMPLATE EMAIL STATICO
// ==========================================
const getFallbackEmail = (order: Order, documentType: 'contratto' | 'manuale' | 'garanzia'): string => {
  const templates = {
    contratto: `
<p>Gentile <strong>${order.rappresentanteLegale}</strong>,</p>

<p>con la presente Le trasmettiamo il contratto relativo all'ordine del <strong>${order.modello}</strong> (matricola: <strong>${order.matricola}</strong>) stipulato in data <strong>${order.dataInserimento}</strong>.</p>

<p>La preghiamo di voler confermare l'accettazione del presente contratto rispondendo alla presente email.</p>

<p>Restiamo a disposizione per qualsiasi chiarimento.</p>

<p>Cordiali saluti,<br>
<strong>Fiordacqua S.r.l.</strong></p>
    `,
    
    manuale: `
<p>Gentile <strong>${order.rappresentanteLegale}</strong>,</p>

<p>in allegato trova il manuale d'uso per il dispositivo <strong>${order.modello}</strong> (matricola: <strong>${order.matricola}</strong>).</p>

<p><strong>IMPORTANTE:</strong> Per procedere con il rilascio della garanzia, è necessario che confermi di aver letto e compreso il presente manuale, controfirmandolo e restituendocelo via email.</p>

<p>La preghiamo di inviare il documento firmato in risposta a questa email.</p>

<p>Cordiali saluti,<br>
<strong>Fiordacqua S.r.l.</strong></p>
    `,
    
    garanzia: `
<p>Gentile <strong>${order.rappresentanteLegale}</strong>,</p>

<p>siamo lieti di trasmetterLe il certificato di garanzia ufficiale per il dispositivo <strong>${order.modello}</strong> (matricola: <strong>${order.matricola}</strong>).</p>

<p>Il prodotto è coperto da garanzia secondo i termini indicati nel documento allegato.</p>

<p>La ringraziamo per aver scelto Fiordacqua e restiamo a disposizione per qualsiasi necessità.</p>

<p>Cordiali saluti,<br>
<strong>Fiordacqua S.r.l.</strong></p>
    `
  };

  return templates[documentType];
};