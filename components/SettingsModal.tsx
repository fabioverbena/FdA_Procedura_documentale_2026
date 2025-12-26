
import React, { useState } from 'react';
import { AppConfig } from '../types';
import { getConfig, saveConfig, getAuthToken, setAuthToken, logoutGoogle, seedTestData } from '../services/googleService';

interface SettingsModalProps {
  onSave: (config: AppConfig) => void;
  onClose: () => void;
  onSeed: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onSave, onClose, onSeed }) => {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [isAuthorized, setIsAuthorized] = useState(!!getAuthToken());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    saveConfig(config);
    onSave(config);
    onClose();
  };

  const handleGoogleAuth = () => {
    if (isAuthorized) {
      logoutGoogle();
      setIsAuthorized(false);
    } else {
      const fakeToken = "ya29.a0AfH6SMA...";
      setAuthToken(fakeToken);
      setIsAuthorized(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 bg-[#00adef] text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold italic tracking-tighter uppercase">FIORDACQUA <span className="text-white/70 text-sm not-italic ml-2">Configurazione Cloud</span></h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Status Connessione */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAuthorized ? 'bg-green-100 text-green-600' : 'bg-[#00adef]/10 text-[#00adef]'}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.2-1.84 4.12-1.04 1.04-2.68 2.12-5.48 2.12-4.44 0-8.08-3.6-8.08-8.08s3.64-8.08 8.08-8.08c2.4 0 4.2 1 5.48 2.24l2.32-2.32C19.04 2.52 16.12 1 12.48 1 6.24 1 12.48 6.24 23.96 12.48 23.96c3.36 0 6.12-1.12 8.32-3.44 2.2-2.2 2.88-5.32 2.88-8.04 0-.76-.08-1.48-.2-2.08h-11z"/></svg>
              </div>
              <div>
                <p className="font-black text-slate-800 uppercase tracking-tighter text-sm">Account Google Cloud</p>
                <p className="text-xs text-slate-500">{isAuthorized ? 'fiordacqua@gmail.com (Attivo)' : 'Non autorizzato'}</p>
              </div>
            </div>
            <button onClick={handleGoogleAuth} className={`px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${isAuthorized ? 'bg-red-50 text-red-600' : 'bg-[#00adef] text-white'}`}>
              {isAuthorized ? 'Scollega' : 'Collega'}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Identità e Drive</h4>
            <div className="grid gap-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">URL Logo (Incolla link Drive o ID)</label>
                <input type="text" name="logoUrl" value={config.logoUrl} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" placeholder="https://drive.google.com/file/d/..." />
                <p className="text-[9px] text-slate-400 mt-1 italic">Verrà convertito automaticamente in link diretto.</p>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Cartella Radice (Drive)</label>
                <input type="text" name="rootFolderId" value={config.rootFolderId} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Google Sheet (Database)</label>
                <input type="text" name="spreadsheetId" value={config.spreadsheetId} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">ID Template Documenti</h4>
            <div className="grid gap-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Template CONTRATTO</label>
                <input type="text" name="templateContrattoId" value={config.templateContrattoId} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Template MANUALE</label>
                <input type="text" name="templateManualeId" value={config.templateManualeId} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Template GARANZIA</label>
                <input type="text" name="templateGaranziaId" value={config.templateGaranziaId} onChange={handleChange} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button onClick={onSeed} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-[#00adef] hover:text-[#00adef] transition-all">
               Genera 10 Record di Test (Sostituisce i dati attuali)
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-xs font-bold text-slate-600 uppercase tracking-widest">Annulla</button>
          <button onClick={handleSave} className="px-10 py-2.5 bg-[#00adef] text-white text-xs font-black rounded-xl shadow-xl hover:bg-[#009bd6] transition-all uppercase tracking-widest">Salva</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
