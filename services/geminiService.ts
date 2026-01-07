// services/geminiService.ts
// Generazione email professionali con Gemini AI (Google)

import { GoogleGenAI } from '@google/generative-ai';
import { Order } from '../types';

const getApiKey = (): string => {
  const key = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!key) {
    console.warn('⚠️ GEMINI_API_KEY non configurata. Setta VITE_GEMINI_API_KEY in .env.local');
  }
  
  return key;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Genera email professionale usando Gemini AI
 * NOTA: Gemini potrebbe non funzionare in alcune regioni (es. Italia)
 * In caso di errore, usa il fallback template statico
 */
export const generateProfessionalEmail = async (
  order: Order,
  documentType: string
): Promise<string> => {
  // Se non c'è API key, usa template statico
  if (!apiKey || !ai) {
    console.log('📧 Uso template statico (Gemini API non configurata)');
    return getStaticTemplate(order.nomeAzienda, documentType);
  }

  try {
    console.log('🤖 Tentativo generazione email con Gemini AI...');
    
    const docTypeMap: Record<string, string> = {
      'contratto': 'contratto di vendita',
      'manuale': 'manuale operativo',
      'garanzia': 'certificato di garanzia',
      'ddt': 'documento di trasporto (DDT)',
      'fattura': 'fattura',
      'ordine': 'ordine fornitore'
    };

    const docName = docTypeMap[documentType] || documentType;

    const prompt = `Genera un'email professionale in italiano per inviare un ${docName} all'azienda "${order.nomeAzienda}".

REQUISITI:
- Tono formale e professionale
- Breve (max 5 righe)
- Indica che il documento è in allegato
- Firma con "Il Team Fiordacqua"
- NON usare Subject/Oggetto (solo corpo email)
- Formato HTML semplice (usa <p>, <br>, <strong> se necessario)

Genera SOLO il corpo dell'email, senza altro testo.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      prompt: prompt
    });

    const emailBody = result.text || '';
    console.log('✅ Email generata con Gemini AI');
    return emailBody;

  } catch (error: any) {
    // Gemini non disponibile in questa regione o altro errore
    console.error('❌ Gemini API Error:', error.message || error);
    console.log('📧 Uso template statico (fallback)');
    return getStaticTemplate(order.nomeAzienda, documentType);
  }
};

/**
 * Template statico di fallback (usato quando Gemini non è disponibile)
 */
const getStaticTemplate = (nomeAzienda: string, documentType: string): string => {
  const docTypeMap: Record<string, string> = {
    'contratto': 'il contratto di vendita',
    'manuale': 'il manuale operativo',
    'garanzia': 'il certificato di garanzia',
    'ddt': 'il documento di trasporto (DDT)',
    'fattura': 'la fattura',
    'ordine': "l'ordine fornitore"
  };

  const docName = docTypeMap[documentType] || 'la documentazione';

  return `<p>Gentile ${nomeAzienda},</p>

<p>In allegato trovate ${docName} come da accordi.</p>

<p>Restiamo a disposizione per qualsiasi chiarimento.</p>

<p><strong>Cordiali saluti,</strong><br>
Il Team Fiordacqua</p>`;
};