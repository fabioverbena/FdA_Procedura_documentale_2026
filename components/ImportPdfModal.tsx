import React, { useState, useEffect, useCallback } from 'react';
import { Order } from '../types';
import { checkLocalServiceHealth, getRecentPdfs, downloadPdfBytes, extractTextFromPdfBytes, LocalPdfFile } from '../services/localPdfService';
import { parseDocumentText, ParsedClientData } from '../services/pdfParserService';

interface ImportPdfModalProps {
  show: boolean;
  onClose: () => void;
  onManual: () => void;
  onImportData: (data: Partial<Order>) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

type Step = 'choose' | 'list' | 'preview';

const ImportPdfModal: React.FC<ImportPdfModalProps> = ({
  show,
  onClose,
  onManual,
  onImportData,
  showToast,
}) => {
  const [step, setStep] = useState<Step>('choose');
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [files, setFiles] = useState<LocalPdfFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedClientData | null>(null);
  const [selectedFilename, setSelectedFilename] = useState('');

  // Reset al primo show
  useEffect(() => {
    if (show) {
      setStep('choose');
      setServiceAvailable(null);
      setFiles([]);
      setParsedData(null);
      setSelectedFilename('');
    }
  }, [show]);

  const checkService = useCallback(async () => {
    setLoading(true);
    const ok = await checkLocalServiceHealth();
    setServiceAvailable(ok);
    setLoading(false);
    return ok;
  }, []);

  // Check health quando si apre il modale
  useEffect(() => {
    if (show) {
      checkService();
    }
  }, [show, checkService]);

  const handleChoosePdf = async () => {
    if (!serviceAvailable) {
      showToast('Servizio PDF locale non disponibile. Funzione attiva solo su PC Lavoro.', 'error');
      return;
    }
    setStep('list');
    setLoading(true);
    try {
      const recent = await getRecentPdfs(5);
      setFiles(recent);
    } catch (e) {
      console.error('Errore caricamento PDF recenti:', e);
      showToast('Errore nel recupero dei PDF recenti', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const recent = await getRecentPdfs(5);
      setFiles(recent);
    } catch (e) {
      showToast('Errore aggiornamento lista', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (file: LocalPdfFile) => {
    setLoading(true);
    setSelectedFilename(file.filename);
    try {
      const bytes = await downloadPdfBytes(file.id);
      const text = await extractTextFromPdfBytes(bytes);
      const parsed = parseDocumentText(text);
      setParsedData(parsed);
      setStep('preview');
    } catch (e) {
      console.error('Errore parsing PDF:', e);
      showToast('Errore durante la lettura del PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUseParsedData = () => {
    if (!parsedData) return;

    const orderData: Partial<Order> = {};
    if (parsedData.nomeAzienda) orderData.nomeAzienda = parsedData.nomeAzienda;
    if (parsedData.piva) orderData.piva = parsedData.piva.replace(/^IT/i, '');
    if (parsedData.indirizzo) orderData.indirizzo = parsedData.indirizzo;
    if (parsedData.cap) orderData.cap = parsedData.cap;
    if (parsedData.citta) orderData.citta = parsedData.citta;
    if (parsedData.provincia) orderData.provincia = parsedData.provincia;
    if (parsedData.importoTotale) orderData.prezzo = parsedData.importoTotale;

    onImportData(orderData);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const docTypeLabel = (dt: string): string => {
    const map: Record<string, string> = {
      DDT: 'DDT',
      FATTURA: 'Fattura',
      PREVENTIVO: 'Preventivo',
      SCONOSCIUTO: 'Documento',
    };
    return map[dt] || dt;
  };

  const docTypeColor = (dt: string): string => {
    const map: Record<string, string> = {
      DDT: 'bg-blue-100 text-blue-700',
      FATTURA: 'bg-green-100 text-green-700',
      PREVENTIVO: 'bg-purple-100 text-purple-700',
      SCONOSCIUTO: 'bg-slate-100 text-slate-600',
    };
    return map[dt] || 'bg-slate-100 text-slate-600';
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 bg-[#00adef] text-white flex justify-between items-center">
          <h3 className="text-lg font-bold tracking-tight">
            {step === 'choose' && 'Nuovo Ordine'}
            {step === 'list' && 'Seleziona PDF'}
            {step === 'preview' && 'Dati Estratti'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* STEP 1: Scegli sorgente */}
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-6">
                Come vuoi inserire i dati del nuovo ordine?
              </p>

              {/* Da PDF */}
              <button
                onClick={handleChoosePdf}
                disabled={loading || serviceAvailable === false}
                className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                  serviceAvailable === false
                    ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-50'
                    : 'border-slate-200 hover:border-[#00adef] hover:bg-blue-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 text-sm block">
                    Importa da PDF (DDT / Fattura / Preventivo)
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {serviceAvailable === null && loading
                      ? 'Verifica servizio locale...'
                      : serviceAvailable === false
                        ? 'Servizio locale non disponibile'
                        : 'Seleziona un PDF recente dall\'ERP'}
                  </span>
                </div>
                {loading && serviceAvailable === null && (
                  <div className="w-5 h-5 border-2 border-[#00adef] border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>

              {/* Manuale */}
              <button
                onClick={onManual}
                className="w-full p-5 rounded-xl border-2 border-slate-200 hover:border-[#00adef] hover:bg-blue-50/50 text-left transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 text-sm block">
                    Inserimento Manuale
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Compila tutti i campi a mano
                  </span>
                </div>
              </button>

              {serviceAvailable === false && (
                <p className="text-xs text-orange-500 text-center mt-2">
                  Il servizio PDF locale non risponde. Verifica che sia attivo su questo PC.
                </p>
              )}
            </div>
          )}

          {/* STEP 2: Lista PDF recenti */}
          {step === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">Ultimi PDF disponibili</p>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="text-xs text-[#00adef] font-bold hover:underline disabled:opacity-50"
                >
                  Aggiorna
                </button>
              </div>

              {loading && files.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-[#00adef] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {!loading && files.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">Nessun PDF trovato nella cartella</p>
                </div>
              )}

              {files.map(file => (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  disabled={loading}
                  className="w-full p-4 rounded-xl border border-slate-200 hover:border-[#00adef] hover:bg-blue-50/30 text-left transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-700 text-sm block truncate">
                      {file.filename}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      {formatDate(file.mtime)} &middot; {formatFileSize(file.size)}
                    </span>
                  </div>
                </button>
              ))}

              {loading && files.length > 0 && (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-[#00adef] border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-xs text-slate-400">Analisi PDF in corso...</span>
                </div>
              )}

              <button
                onClick={() => setStep('choose')}
                className="w-full mt-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
              >
                Indietro
              </button>
            </div>
          )}

          {/* STEP 3: Preview dati estratti */}
          {step === 'preview' && parsedData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${docTypeColor(parsedData.docType)}`}>
                  {docTypeLabel(parsedData.docType)}
                </span>
                <span className="text-xs text-slate-400 truncate">{selectedFilename}</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <PreviewRow label="Nome Azienda" value={parsedData.nomeAzienda} />
                <PreviewRow label="P.IVA" value={parsedData.piva} />
                <PreviewRow label="Indirizzo" value={parsedData.indirizzo} />
                <PreviewRow label="CAP" value={parsedData.cap} />
                <PreviewRow label="Città" value={parsedData.citta} />
                <PreviewRow label="Provincia" value={parsedData.provincia} />
                {parsedData.descrizioneArticolo && (
                  <PreviewRow label="Descrizione" value={parsedData.descrizioneArticolo} />
                )}
                {parsedData.totaleImponibile !== null && (
                  <PreviewRow label="Totale Imponibile" value={`€ ${parsedData.totaleImponibile.toFixed(2)}`} />
                )}
                {parsedData.importoTotale !== null && parsedData.importoTotale !== parsedData.totaleImponibile && (
                  <PreviewRow label="Totale Fattura" value={`€ ${parsedData.importoTotale.toFixed(2)}`} />
                )}
                {parsedData.docNumero && (
                  <PreviewRow label="Rif. Documento" value={`${docTypeLabel(parsedData.docType)} ${parsedData.docNumero}${parsedData.docData ? ` del ${parsedData.docData}` : ''}`} />
                )}
              </div>

              {!parsedData.nomeAzienda && !parsedData.piva && (
                <p className="text-xs text-orange-500 text-center">
                  Nessun dato cliente trovato nel PDF. Prova con un altro documento.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('list'); setParsedData(null); }}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Altro PDF
                </button>
                <button
                  onClick={handleUseParsedData}
                  disabled={!parsedData.nomeAzienda && !parsedData.piva}
                  className="flex-1 py-2.5 text-xs font-bold text-white uppercase tracking-widest bg-[#00adef] rounded-xl hover:bg-[#009bd6] transition-all shadow-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Usa questi dati
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Componente helper per righe preview ---
const PreviewRow: React.FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <span className={`text-sm font-semibold ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
      {value || '—'}
    </span>
  </div>
);

export default ImportPdfModal;
