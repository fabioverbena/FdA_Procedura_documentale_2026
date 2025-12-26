
import React from 'react';
import { Order, OrderStatus } from '../types';

interface WorkflowModalProps {
  order: Order;
  onUpdateWorkflow: (id: string, workflow: Order['workflow']) => void;
  onContinue: (order: Order, forcedDocType?: 'contratto' | 'manuale' | 'garanzia') => void;
  onClose: () => void;
  onToggleStatus?: (id: string, current: OrderStatus) => void;
}

const WorkflowModal: React.FC<WorkflowModalProps> = ({ order, onUpdateWorkflow, onContinue, onClose, onToggleStatus }) => {
  // Mappatura dei 10 punti richiesti
  const steps = [
    { id: 1, label: 'Invio Contratto', key: 'contrattoInviato', type: 'action', doc: 'contratto' },
    { id: 2, label: 'Emissione PDF e Invio Email', key: 'contrattoInviato', type: 'action', doc: 'contratto' },
    { id: 3, label: 'Verifica Email Inviata', key: 'contrattoInviato', type: 'check' },
    { id: 4, label: 'Flag Contratto Accettato', key: 'contrattoFirmato', type: 'flag' },
    { id: 5, label: 'Emissione PDF Manuale e Invio Email', key: 'manualeInviato', type: 'action', doc: 'manuale' },
    { id: 6, label: 'Verifica Email Inviata', key: 'manualeInviato', type: 'check' },
    { id: 7, label: 'Flag Manuale Controfirmato', key: 'manualeFirmato', type: 'flag' },
    { id: 8, label: 'Emissione PDF Garanzia e Invio Email', key: 'garanziaRilasciata', type: 'action', doc: 'garanzia' },
    { id: 9, label: 'Verifica Email Inviata', key: 'garanziaRilasciata', type: 'check' },
    { id: 10, label: 'Iter Terminato', key: 'garanziaRilasciata', type: 'final' },
  ];

  // Determina l'indice del passo attuale in base allo stato del workflow
  const getCurrentStepIndex = () => {
    if (order.status === OrderStatus.CONCLUSO) return 9;
    if (!order.workflow.contrattoInviato) return 0;
    if (!order.workflow.contrattoFirmato) return 3; // Fermo al flag accettazione
    if (!order.workflow.manualeInviato) return 4;   // Fermo all'invio manuale
    if (!order.workflow.manualeFirmato) return 6;   // Fermo al flag manuale
    if (!order.workflow.garanziaRilasciata) return 7; // Fermo all'invio garanzia
    return 9;
  };

  const currentIndex = getCurrentStepIndex();

  const handleNext = () => {
    const currentStep = steps[currentIndex];
    
    // Se il passo richiede un'azione esterna (Email/PDF), delega ad App.tsx
    if (currentStep.type === 'action' && currentStep.doc) {
      onContinue(order, currentStep.doc as any);
      return;
    }

    // Se è un flag o un check, aggiorna il workflow localmente
    const nextKey = steps[currentIndex].key;
    const newWorkflow = { ...order.workflow, [nextKey]: true };
    onUpdateWorkflow(order.id, newWorkflow);
  };

  const isSospeso = order.status === OrderStatus.SOSPESO;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200">
        <div className={`p-6 border-b flex justify-between items-center ${isSospeso ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSospeso ? 'bg-yellow-100 text-yellow-600' : 'bg-[#00adef] text-white shadow-lg shadow-[#00adef]/30'}`}>
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">FLUSSO <span className="text-[#00adef]">OPERATIVO</span></h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{order.nomeAzienda}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/30">
          <div className="relative">
            {/* Linea verticale di connessione */}
            <div className="absolute left-[19px] top-4 bottom-4 w-1 bg-slate-100"></div>
            
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const isPast = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isFuture = idx > currentIndex;

                return (
                  <div key={idx} className={`flex gap-6 items-center transition-all duration-500 ${isFuture ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shadow-sm ${
                      isPast ? 'bg-green-500 text-white' : 
                      isCurrent ? 'bg-[#00adef] text-white scale-110 shadow-lg ring-4 ring-[#00adef]/10' : 
                      'bg-white border-2 border-slate-200 text-slate-300'
                    }`}>
                      {isPast ? (
                        <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 001.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-xs font-black uppercase tracking-widest ${isCurrent ? 'text-slate-900' : isPast ? 'text-green-600' : 'text-slate-400'}`}>
                        {step.label}
                      </h4>
                      {isCurrent && (
                        <p className="text-[9px] font-bold text-[#00adef] uppercase mt-0.5 animate-pulse">Azione richiesta adesso</p>
                      )}
                    </div>
                    {isPast && (
                      <div className="text-green-500">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="p-8 bg-white border-t flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => onToggleStatus && onToggleStatus(order.id, order.status)}
            className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 border-2 ${
              isSospeso 
                ? 'bg-yellow-400 border-yellow-400 text-white hover:bg-yellow-500' 
                : 'bg-white border-slate-100 text-slate-400 hover:border-yellow-400 hover:text-yellow-500'
            }`}
          >
            {isSospeso ? 'Riprendi Iter' : 'Sospendi Ordine'}
          </button>

          {currentIndex < 9 && !isSospeso && (
            <button 
              onClick={handleNext}
              className="flex-[2] px-6 py-4 bg-[#00adef] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[#00adef]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
              <span>Continua Procedura</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7" /></svg>
            </button>
          )}

          {currentIndex >= 9 && (
            <div className="flex-[2] px-6 py-4 bg-green-500 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-green-200 flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Iter Concluso
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;
