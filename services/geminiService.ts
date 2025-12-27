import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

// Inizializzazione con supporto per variabili d'ambiente Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateProfessionalEmail = async (order: Order, documentType: 'contratto' | 'manuale' | 'garanzia'): Promise<string> => {
  const prompt = `
    Sei un assistente professionale dell'azienda Fiordacqua. Scrivi una email formale in italiano per il cliente ${order.nomeAzienda}.
    
    Tipo documento allegato: ${documentType.toUpperCase()}
    Dettagli Ordine:
    - Data: ${order.dataInserimento}
    - Modello: ${order.modello}
    - Matricola: ${order.matricola}
    - Rappresentante Legale: ${order.rappresentanteLegale}
    
    ${documentType === 'contratto' ? 'Chiedi gentilmente al cliente di rispondere alla mail per accettazione formale del contratto allegato.' : ''}
    ${documentType === 'manuale' ? 'Specifica che il cliente conferma di aver letto e compreso il manuale e che tale documento deve essere controfirmato e restituito, pena il non rilascio della garanzia.' : ''}
    ${documentType === 'garanzia' ? 'Invia il certificato di garanzia ufficiale per il prodotto acquistato.' : ''}
    
    Il tono deve essere professionale, cortese ed efficiente. Non inventare dati extra. Concludi in modo formale.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Gentile Cliente, in allegato i documenti relativi al suo ordine. Restiamo in attesa di un suo riscontro. Cordiali saluti, Fiordacqua.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Gentile Cliente, in allegato i documenti relativi al suo ordine. Restiamo in attesa di un suo riscontro. Cordiali saluti, Fiordacqua.";
  }
};