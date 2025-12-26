
import React, { useState, useEffect } from 'react';
import { Order, ContractType, ModelType, ConditionType, OrderStatus } from '../types';

interface OrderFormProps {
  initialData?: Order | null;
  onSubmit: (data: Partial<Order>, action: 'save' | 'print' | 'email') => void;
  onCancel: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Order>>({
    dataInserimento: new Date().toISOString().split('T')[0],
    tipoContratto: ContractType.NUOVO,
    nomeAzienda: '',
    rappresentanteLegale: '',
    indirizzo: '',
    cap: '',
    citta: '',
    piva: '',
    emailContatto: '',
    modello: ModelType.LEO2,
    matricola: '',
    condizione: ConditionType.NUOVO,
    prezzo: 0,
    status: OrderStatus.IN_CORSO,
    workflow: {
        contrattoInviato: false,
        contrattoFirmato: false,
        manualeInviato: false,
        manualeFirmato: false,
        garanziaRilasciata: false
    }
  });

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        dataInserimento: new Date().toISOString().split('T')[0],
        tipoContratto: ContractType.NUOVO,
        nomeAzienda: '',
        rappresentanteLegale: '',
        indirizzo: '',
        cap: '',
        citta: '',
        piva: '',
        emailContatto: '',
        modello: ModelType.LEO2,
        matricola: '',
        condizione: ConditionType.NUOVO,
        prezzo: 0,
        status: OrderStatus.IN_CORSO,
        workflow: {
            contrattoInviato: false,
            contrattoFirmato: false,
            manualeInviato: false,
            manualeFirmato: false,
            garanziaRilasciata: false
        }
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (action: 'save' | 'print' | 'email') => {
    if (!formData.nomeAzienda || !formData.piva) {
      alert("Si prega di inserire Nome Azienda e PIVA");
      return;
    }
    onSubmit(formData, action);
  };

  // Logica criteri di filtro documenti (stessi usati nei modal)
  const canEmail = initialData ? (
    // Se è un ordine esistente, deve esserci almeno un documento "emesso" (inviato o rilasciato)
    initialData.workflow.contrattoInviato || 
    initialData.workflow.manualeInviato || 
    initialData.workflow.garanziaRilasciata
  ) : true; // Nuovo ordine: permette l'invio del primo contratto

  const canPrint = true; // La stampa è sempre permessa (almeno per il contratto base)

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-xl font-bold text-slate-800">
          {initialData ? `Modifica Ordine: ${initialData.nomeAzienda}` : 'Nuovo Inserimento Ordine'}
        </h2>
        <div className="flex items-center gap-3">
           <label className="text-sm font-bold text-slate-500 uppercase">Stato Iter:</label>
           <select 
             name="status" 
             value={formData.status} 
             onChange={handleChange}
             className={`px-3 py-1 rounded-full text-xs font-bold border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
               formData.status === OrderStatus.SOSPESO ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 
               formData.status === OrderStatus.CONCLUSO ? 'bg-green-100 border-green-300 text-green-800' :
               'bg-orange-100 border-orange-300 text-orange-800'
             }`}
           >
             <option value={OrderStatus.IN_CORSO}>IN CORSO</option>
             <option value={OrderStatus.SOSPESO}>SOSPESO</option>
             {initialData && <option value={OrderStatus.CONCLUSO}>ITER CONCLUSO</option>}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Data Inserimento</label>
          <input type="date" name="dataInserimento" value={formData.dataInserimento} onChange={handleChange} className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo Contratto</label>
          <select name="tipoContratto" value={formData.tipoContratto} onChange={handleChange} className="w-full border p-2 rounded-lg">
            {Object.values(ContractType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Condizione</label>
          <select name="condizione" value={formData.condizione} onChange={handleChange} className="w-full border p-2 rounded-lg">
            {Object.values(ConditionType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Azienda</label>
          <input type="text" name="nomeAzienda" value={formData.nomeAzienda} onChange={handleChange} placeholder="Fiordacqua S.r.l." className="w-full border p-2 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">P.IVA</label>
          <input type="text" name="piva" value={formData.piva} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Rappresentante Legale</label>
          <input type="text" name="rappresentanteLegale" value={formData.rappresentanteLegale} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Email Contatto</label>
          <input type="email" name="emailContatto" value={formData.emailContatto} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Prezzo (€)</label>
          <input type="number" name="prezzo" value={formData.prezzo} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Indirizzo</label>
          <input type="text" name="indirizzo" value={formData.indirizzo} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">CAP</label>
            <input type="text" name="cap" value={formData.cap} onChange={handleChange} className="w-full border p-2 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Città</label>
            <input type="text" name="citta" value={formData.citta} onChange={handleChange} className="w-full border p-2 rounded-lg" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Modello</label>
          <select name="modello" value={formData.modello} onChange={handleChange} className="w-full border p-2 rounded-lg">
            {Object.values(ModelType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Matricola</label>
          <input type="text" name="matricola" value={formData.matricola} onChange={handleChange} className="w-full border p-2 rounded-lg" />
        </div>
      </div>

      <div className="mt-12 flex flex-col md:flex-row gap-4 justify-between border-t pt-8">
        <button onClick={onCancel} className="px-6 py-2 text-slate-600 font-medium hover:text-slate-800 transition-colors">Annulla</button>
        <div className="flex flex-wrap gap-4">
           <button 
             onClick={() => handleSubmit('save')} 
             className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-all shadow-sm border border-slate-200"
           >
             Salva Modifiche
           </button>
           <button 
             disabled={!canPrint}
             onClick={() => handleSubmit('print')} 
             className={`px-6 py-2 font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${canPrint ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
             Salva e Stampa
           </button>
           <button 
             disabled={!canEmail}
             onClick={() => handleSubmit('email')} 
             className={`px-6 py-2 font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${canEmail ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
             Salva e Invia Mail
           </button>
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
