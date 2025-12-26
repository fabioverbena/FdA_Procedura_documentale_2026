
import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { generateProfessionalEmail } from '../services/geminiService';

interface EmailModalProps {
  order: Order;
  onSend: (content: string, selectedDocs: string[]) => void;
  onClose: () => void;
  forcedDocType?: 'contratto' | 'manuale' | 'garanzia';
}

const EmailModal: React.FC<EmailModalProps> = ({ order, onSend, onClose, forcedDocType }) => {
  const [step, setStep] = useState<'select' | 'preview'>(forcedDocType ? 'preview' : 'select');
  const [selectedDocs, setSelectedDocs] = useState<string[]>(forcedDocType ? [forcedDocType] : []);
  const [emailContent, setEmailContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (forcedDocType) {
      handleProceedToEmail(forcedDocType);
    }
  }, [forcedDocType]);

  const handleProceedToEmail = async (docToUse?: string) => {
    const doc = docToUse || (selectedDocs.length > 0 ? selectedDocs[0] : null);
    if (!doc) {
      alert("Seleziona almeno un documento da inviare.");
      return;
    }

    setIsGenerating(true);
    setStep('preview');
    if (docToUse && !selectedDocs.includes(docToUse)) {
      setSelectedDocs([docToUse]);
    }

    try {
      const content = await generateProfessionalEmail(order, doc as any);
      setEmailContent(content);
    } catch (error) {
      setEmailContent("Gentile Cliente, in allegato i documenti relativi alla procedura Fiordacqua. Restiamo a disposizione. Cordiali saluti.");
    } finally {
      setIsGenerating(false);
    }
  };

  const availableDocs = [
    { id: 'contratto', label: 'Contratto di Vendita', active: true },
    { id: 'manuale', label: 'Manuale Operativo', active: order.workflow.contrattoFirmato },
    { id: 'garanzia', label: 'Certificato di Garanzia', active: order.workflow.manualeFirmato },
  ].filter(d => d.active);

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center shadow-lg">
          <div>
            <h3 className="text-xl font-black italic tracking-tighter uppercase">EMISSIONE <span className="text-blue-200">DOCUMENTI</span></h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">{order.nomeAzienda} • Step {step === 'select' ? '1/2' : '2/2'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8">
          {step === 'select' ? (
            <div className="space-y-6">
               <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                  <div className="p-2 bg-blue-600 text-white rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-blue-800 leading-relaxed uppercase tracking-tight">
                    Seleziona il documento da emettere in PDF e inviare via email. I template verranno compilati automaticamente con i dati del cliente.
                  </p>
               </div>

               <div className="grid gap-3">
                  {availableDocs.map(doc => (
                    <label key={doc.id} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedDocs.includes(doc.id) ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${selectedDocs.includes(doc.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase tracking-tighter text-sm">{doc.label}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Template Cloud attivo</span>
                        </div>
                      </div>
                      <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)} className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" />
                    </label>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-6">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-slate-800 font-black uppercase tracking-widest text-xs">Gemini AI sta elaborando...</p>
                    <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Scrittura email professionale in corso</p>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-[100px_1fr] gap-y-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-6 mb-6">
                    <span>Mittente:</span> <span className="text-slate-900 lowercase italic">fiordacqua@gmail.com</span>
                    <span>Destinatario:</span> <span className="text-[#00adef] lowercase italic">{order.emailContatto}</span>
                    <span>CCN:</span> <span className="text-slate-900 lowercase italic">fiordacqua@gmail.com</span>
                    <span>Allegato:</span> <span className="text-blue-600">PDF_{selectedDocs[0]?.toUpperCase()}_2026.pdf</span>
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 shadow-inner">
                    <textarea 
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      className="w-full h-64 bg-transparent border-none focus:ring-0 text-slate-700 font-medium text-sm resize-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Annulla</button>
          
          {step === 'select' ? (
            <button 
              onClick={() => handleProceedToEmail()}
              disabled={selectedDocs.length === 0}
              className={`px-10 py-3 font-black rounded-2xl shadow-xl transition-all flex items-center gap-3 text-xs uppercase tracking-widest ${selectedDocs.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              Procedi all'Invio
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          ) : (
            <div className="flex gap-4">
              {!forcedDocType && (
                <button onClick={() => setStep('select')} className="px-6 py-3 bg-white border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all text-slate-600">
                  Indietro
                </button>
              )}
              <button 
                disabled={isGenerating}
                onClick={() => onSend(emailContent, selectedDocs)}
                className="px-10 py-3 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
              >
                Invia Documentazione
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
