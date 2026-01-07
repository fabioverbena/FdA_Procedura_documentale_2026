import React, { useState } from 'react';
import { Order } from '../types';

interface PrintModalProps {
  order: Order;
  onClose: () => void;
  onPrint: (documentType: 'contratto' | 'manuale' | 'garanzia') => Promise<void>;
}

const PrintModal: React.FC<PrintModalProps> = ({ order, onClose, onPrint }) => {
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [docs, setDocs] = useState({
    contratto: true,
    manuale: order.workflow.contrattoFirmato,
    garanzia: order.workflow.manualeFirmato
  });

  const handlePrint = async () => {
    const selectedDocs = Object.entries(docs)
      .filter(([_, v]) => v)
      .map(([k, _]) => k as 'contratto' | 'manuale' | 'garanzia');
    
    if (selectedDocs.length === 0) {
      alert('Seleziona almeno un documento!');
      return;
    }

    setIsPrinting(true);
    
    try {
      for (const docType of selectedDocs) {
        for (let i = 0; i < copies; i++) {
          await onPrint(docType);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Errore stampa:', error);
      alert('Errore durante la generazione dei documenti');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
          <div>
            <h3 className="text-xl font-bold">Stampa Documenti</h3>
            <p className="text-xs text-slate-400">{order.nomeAzienda}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
             <label className="block text-sm font-bold text-slate-700">Seleziona documenti validi:</label>
             <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                   <input type="checkbox" checked={docs.contratto} onChange={() => setDocs({...docs, contratto: !docs.contratto})} className="w-4 h-4 text-blue-600" />
                   <span className="text-sm font-medium">Contratto di Vendita</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border border-slate-100 ${!order.workflow.contrattoFirmato ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}>
                   <input type="checkbox" disabled={!order.workflow.contrattoFirmato} checked={docs.manuale} onChange={() => setDocs({...docs, manuale: !docs.manuale})} className="w-4 h-4 text-blue-600" />
                   <span className="text-sm font-medium">Manuale Operativo {(!order.workflow.contrattoFirmato) && '(Sblocca dopo firma contratto)'}</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border border-slate-100 ${!order.workflow.manualeFirmato ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}>
                   <input type="checkbox" disabled={!order.workflow.manualeFirmato} checked={docs.garanzia} onChange={() => setDocs({...docs, garanzia: !docs.garanzia})} className="w-4 h-4 text-blue-600" />
                   <span className="text-sm font-medium">Certificato di Garanzia {(!order.workflow.manualeFirmato) && '(Sblocca dopo firma manuale)'}</span>
                </label>
             </div>
          </div>

          <div>
             <label className="block text-sm font-bold text-slate-700 mb-2">Numero di copie:</label>
             <div className="flex items-center gap-4">
                <button onClick={() => setCopies(Math.max(1, copies - 1))} className="w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">-</button>
                <span className="text-lg font-bold w-8 text-center">{copies}</span>
                <button onClick={() => setCopies(copies + 1)} className="w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">+</button>
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
          <button onClick={onClose} disabled={isPrinting} className="px-6 py-2 text-slate-600 font-medium hover:text-slate-800 disabled:opacity-50">
            Annulla
          </button>
          <button 
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-8 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrinting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generazione...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                <span>Stampa Ora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;