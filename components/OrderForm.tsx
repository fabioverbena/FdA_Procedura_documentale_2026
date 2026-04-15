import React, { useState } from 'react';
import { Order, ContractType, ModelType, ConditionType } from '../types';
import { getOrCreateClientFolder, AndgeneratePrintDocument, uploadFileToDrive } from '../services/googleDriveService';

interface OrderFormProps {
  initialData?: Partial<Order>;
  onSubmit: (order: Partial<Order>, source: 'manual' | 'yousign') => Promise<void>;
  onCancel: () => void;
  onDocumentoReady: (doc: any) => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ 
  initialData, 
  onSubmit, 
  onCancel,
  onDocumentoReady 
}) => {
  const [formData, setFormData] = useState<Partial<Order>>({
    nomeAzienda: initialData?.nomeAzienda || '',
    piva: initialData?.piva || '',
    rappresentanteLegale: initialData?.rappresentanteLegale || '',
    email: initialData?.email || '',
    telefono: initialData?.telefono || '',
    indirizzo: initialData?.indirizzo || '',
    cap: initialData?.cap || '',
    citta: initialData?.citta || '',
    provincia: initialData?.provincia || '',
    tipoContratto: initialData?.tipoContratto || ContractType.NUOVO,
    modello: initialData?.modello || ModelType.LEO2,
    matricola: initialData?.matricola || '',
    condizione: initialData?.condizione || ConditionType.NUOVO,  // 🆕 AGGIUNGI
    prezzo: initialData?.prezzo || 0,  // 🆕 AGGIUNGI
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (source: 'manual' | 'save') => {
    if (source === 'save') {
      await onSubmit(formData, 'manual');
    }
  };

  const handleInviaYouSign = async () => {
    // 1. VALIDAZIONE
    if (!formData.nomeAzienda || !formData.piva) {
      alert('Nome azienda e P.IVA sono obbligatori!');
      return;
    }

    const cleanPIVA = formData.piva.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanPIVA)) {
      alert('P.IVA non valida! Deve contenere esattamente 11 cifre.');
      return;
    }

    setIsGeneratingPDF(true);

    try {
      // 2. CREA CARTELLE SU GOOGLE DRIVE
      const folders = await getOrCreateClientFolder(
        formData.nomeAzienda,
        formData.piva
      );
      
      if (!folders) {
        alert('Errore durante la creazione delle cartelle su Drive');
        return;
      }

      console.log('📁 Cartelle create:', folders);

      // 3. GENERA PDF DAL TEMPLATE GOOGLE DOCS
      const pdfResult = await AndgeneratePrintDocument(
        formData as Order,
        'contratto'
      );

      if (!pdfResult) {
        alert('Errore durante la generazione del PDF dal template');
        return;
      }

      console.log('✅ PDF generato dal template:', pdfResult.filename);

      // 4. DETERMINA IL NOME FILE CORRETTO
      const isGrenke = formData.tipoContratto && 
                       formData.tipoContratto.toLowerCase().includes('grenke');
      
      const finalFileName = isGrenke 
        ? `Accordo CE - ${cleanPIVA}.pdf`
        : `Contratto CE - ${cleanPIVA}.pdf`;

      console.log('📝 Nome file finale:', finalFileName);

      // 5. CONVERTI BASE64 IN BLOB
      const base64Response = await fetch(`data:application/pdf;base64,${pdfResult.base64}`);
      const pdfBlob = await base64Response.blob();

      // 6. SALVA PDF NELLA CARTELLA PRINCIPALE
      const pdfUrl = await uploadFileToDrive(
        pdfBlob,
        finalFileName,
        folders.clientFolderId
      );

      if (!pdfUrl) {
        alert('Errore durante il salvataggio del PDF su Drive');
        return;
      }

      console.log('✅ PDF salvato su Drive:', pdfUrl);

      // 7. PREPARA DOCUMENTO PER MODAL
      onDocumentoReady({
        tipo: isGrenke ? 'Accordo CE' : 'Contratto CE',
        url: pdfUrl,
        filename: finalFileName,
        cliente: formData.nomeAzienda,
        firmatario: formData.rappresentanteLegale || formData.nomeAzienda,
        email: formData.email || '',
        cellulare: formData.telefono || ''
      });

      // 8. AGGIORNA STATUS NEL DATABASE
      await onSubmit({
        ...formData,
        clientFolderId: folders.clientFolderId,
        firmatiFolderId: folders.firmatiFolderId,
        status: 'In attesa firma',
        workflow: {
          contrattoInviato: true,
          contrattoFirmato: false,
          manualeInviato: false,
          manualeFirmato: false,
          garanziaRilasciata: false
        }
      }, 'yousign');

      console.log('✅ Contratto generato, modal aperto!');

    } catch (error) {
      console.error('❌ Errore durante la procedura:', error);
      alert('Errore durante l\'invio. Controlla la console per dettagli.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-xl font-bold text-slate-800">
          {initialData ? 'Modifica Ordine' : 'Nuovo Ordine'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Nome Azienda */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Nome Azienda *
          </label>
          <input 
            type="text" 
            name="nomeAzienda" 
            value={formData.nomeAzienda} 
            onChange={handleChange} 
            placeholder="Fior d'Acqua S.r.l." 
            className="w-full border p-2 rounded-lg"
            required
          />
        </div>

        {/* P.IVA */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            P.IVA *
          </label>
          <input 
            type="text" 
            name="piva" 
            value={formData.piva} 
            onChange={handleChange} 
            placeholder="12345678901"
            className="w-full border p-2 rounded-lg"
            required
          />
        </div>

        {/* Rappresentante Legale */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Rappresentante Legale (Nome Cognome)
          </label>
          <input 
            type="text" 
            name="rappresentanteLegale" 
            value={formData.rappresentanteLegale || ''} 
            onChange={handleChange} 
            placeholder="Mario Rossi"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email
          </label>
          <input 
            type="email" 
            name="email" 
            value={formData.email || ''} 
            onChange={handleChange} 
            placeholder="info@example.com"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Cellulare */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Cellulare
          </label>
          <input 
            type="tel" 
            name="telefono" 
            value={formData.telefono || ''} 
            onChange={handleChange} 
            placeholder="+39 123 456 7890"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Indirizzo */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Indirizzo
          </label>
          <input 
            type="text" 
            name="indirizzo" 
            value={formData.indirizzo || ''} 
            onChange={handleChange} 
            placeholder="Via Roma 123"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* CAP */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            CAP
          </label>
          <input 
            type="text" 
            name="cap" 
            value={formData.cap || ''} 
            onChange={handleChange} 
            placeholder="47890"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Città */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Città
          </label>
          <input 
            type="text" 
            name="citta" 
            value={formData.citta || ''} 
            onChange={handleChange} 
            placeholder="San Marino"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Provincia */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Provincia
          </label>
          <input 
            type="text" 
            name="provincia" 
            value={formData.provincia || ''} 
            onChange={handleChange} 
            placeholder="RSM"
            className="w-full border p-2 rounded-lg"
          />
        </div>

        {/* Tipo Contratto */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Tipo Contratto
          </label>
          <select 
            name="tipoContratto" 
            value={formData.tipoContratto} 
            onChange={handleChange} 
            className="w-full border p-2 rounded-lg"
          >
            {Object.values(ContractType).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Modello */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Modello
          </label>
          <select 
            name="modello" 
            value={formData.modello} 
            onChange={handleChange} 
            className="w-full border p-2 rounded-lg"
          >
            {Object.values(ModelType).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Matricola */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Matricola
          </label>
          <input 
            type="text" 
            name="matricola" 
            value={formData.matricola || ''} 
            onChange={handleChange} 
            placeholder="ABC123"
            className="w-full border p-2 rounded-lg"
          />
        </div>
      </div>
{/* Condizione */}
<div>
  <label className="block text-sm font-semibold text-slate-700 mb-1">
    Condizione *
  </label>
  <select 
    name="condizione" 
    value={formData.condizione} 
    onChange={handleChange} 
    className="w-full border p-2 rounded-lg"
    required
  >
    {Object.values(ConditionType).map(t => (
      <option key={t} value={t}>{t}</option>
    ))}
  </select>
</div>

{/* Prezzo */}
<div>
  <label className="block text-sm font-semibold text-slate-700 mb-1">
    Prezzo (€) *
  </label>
  <input 
    type="number" 
    name="prezzo" 
    value={formData.prezzo || ''} 
    onChange={handleChange} 
    placeholder="5000"
    step="0.01"
    min="0"
    className="w-full border p-2 rounded-lg"
    required
  />
</div>
      {/* Bottoni */}
      <div className="mt-12 flex flex-col md:flex-row gap-4 justify-between border-t pt-8">
        <button 
          onClick={onCancel} 
          className="px-6 py-2 text-slate-600 font-medium hover:text-slate-800 transition-colors"
        >
          Annulla
        </button>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleSubmit('save')} 
            className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-all shadow-sm border border-slate-200"
          >
            Salva Modifiche
          </button>
          
          <button 
            onClick={handleInviaYouSign}
            disabled={isGeneratingPDF}
            className="px-6 py-2 font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {isGeneratingPDF ? '⏳ Generazione...' : '📤 Invia YouSign'}
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4 max-w-md">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                ⏳ Generazione in corso...
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                Creazione cartelle, generazione PDF e salvataggio su Drive
              </p>
              <p className="text-xs text-gray-500">
                Attendere qualche secondo...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderForm;