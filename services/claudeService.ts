// services/claudeService.ts
// Generazione email professionali con Claude AI (Anthropic)

import Anthropic from '@anthropic-ai/sdk';
import { Order } from '../types';

const getApiKey = (): string => {
  const key = import.meta.env.VITE_CLAUDE_API_KEY || '';
  
  if (!key) {
    console.warn('⚠️ CLAUDE_API_KEY non configurata. Setta VITE_CLAUDE_API_KEY in .env.local');
  }
  
  return key;
};

const apiKey = getApiKey();
const anthropic = apiKey ? new Anthropic({ 
  apiKey,
  dangerouslyAllowBrowser: true
}) : null;

export const generateProfessionalEmail = async (
  orderOrName: Order | string,
  documentType?: string
): Promise<string> => {
  let nomeAzienda: string;
  let docType: string;
  
  if (typeof orderOrName === 'string') {
    nomeAzienda = orderOrName;
    docType = documentType || 'contratto';
  } else {
    nomeAzienda = orderOrName.nomeAzienda;
    docType = documentType || 'contratto';
  }

  if (!apiKey || !anthropic) {
    console.log('📧 Uso template statico (Claude API non configurata)');
    return getStaticTemplate(nomeAzienda, docType);
  }

  try {
    console.log('🤖 Generazione email con Claude AI...');
    
    const documentNames: Record<string, string> = {
      'contratto': 'contratto di vendita',
      'manuale': 'manuale operativo',
      'garanzia': 'certificato di garanzia',
      'ddt': 'documento di trasporto (DDT)',
      'fattura': 'fattura',
      'ordine': 'ordine al fornitore',
      'installazione': 'report di installazione',
      'CONTRATTO': 'contratto di vendita',
      'ORDINE_FORNITORE': 'ordine al fornitore',
      'DDT': 'documento di trasporto (DDT)',
      'FATTURA': 'fattura',
      'INSTALLAZIONE': 'report di installazione'
    };

    const docName = documentNames[docType] || documentType;

    const prompt = `Genera un'email professionale in italiano per inviare un ${docName} all'azienda "${nomeAzienda}".

REQUISITI:
- Tono formale e professionale
- Breve (max 5 righe)
- Indica che il documento è in allegato
- Firma con "Il Team Fiordacqua"
- NON usare Subject/Oggetto (solo corpo email)
- Formato HTML semplice (usa <p>, <br>, <strong> se necessario)

Genera SOLO il corpo dell'email, senza altro testo.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const emailBody = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log('✅ Email generata con Claude AI');
    return emailBody;

  } catch (error: any) {
    console.error('❌ Claude API Error:', error.message || error);
    console.log('📧 Uso template statico (fallback)');
    return getStaticTemplate(nomeAzienda, docType);
  }
};

const getStaticTemplate = (nomeAzienda: string, documentType: string): string => {
  const documentNames: Record<string, string> = {
    'contratto': 'il contratto di vendita',
    'manuale': 'il manuale operativo',
    'garanzia': 'il certificato di garanzia',
    'ddt': 'il documento di trasporto (DDT)',
    'fattura': 'la fattura',
    'ordine': "l'ordine al fornitore",
    'installazione': 'il report di installazione',
    'CONTRATTO': 'il contratto di vendita',
    'ORDINE_FORNITORE': "l'ordine al fornitore",
    'DDT': 'il documento di trasporto (DDT)',
    'FATTURA': 'la fattura',
    'INSTALLAZIONE': 'il report di installazione'
  };

  const docName = documentNames[documentType] || 'la documentazione';

  return `<p>Gentile ${nomeAzienda},</p>

<p>In allegato trovate ${docName} come da accordi.</p>

<p>Restiamo a disposizione per qualsiasi chiarimento.</p>

<p><strong>Cordiali saluti,</strong><br>
Il Team Fiordacqua</p>`;
};
