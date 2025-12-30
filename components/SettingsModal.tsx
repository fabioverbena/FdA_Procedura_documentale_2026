import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { getConfig, saveConfig, seedTestData } from '../services/googleService';
import { isAuthenticated, initiateGoogleLogin, logout, getToken } from '../services/googleAuth';

interface SettingsModalProps {
  onSave: (config: AppConfig) => void;
  onClose: () => void;
  onSeed: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onSave, onClose, onSeed }) => {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    
    if (isAuthenticated()) {
      fetchUserEmail();
    }
  }, []);

  const fetchUserEmail = async () => {
    try {
      const token = getToken();
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUserEmail(data.email || '');
    } catch (error) {
      console.error('Errore recupero email:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
  console.log('Salvataggio config:', config);
  saveConfig(config);
  
  // Verifica che sia stato salvato
  const saved = getConfig();
  console.log('Config salvata verificata:', saved);
  
  onSave(config);
  onClose();
};

  const handleAuth = () => {
    if (authenticated) {
      if (confirm('Vuoi disconnettere il tuo account Google?')) {
        logout();
        setAuthenticated(false);
        setUserEmail('');
      }
    } else {
      initiateGoogleLogin();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 bg-[#00adef] text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold italic tracking-tighter uppercase">
              FIORDACQUA <span className="text-white/70 text-sm not-italic ml-2">Configurazione Cloud</span>
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Status Connessione OAuth */}
          <div className={`p-6 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-6 ${
            authenticated 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                authenticated 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-yellow-100 text-yellow-600'
              }`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.2-1.84 4.12-1.04 1.04-2.68 2.12-5.48 2.12-4.44 0-8.08-3.6-8.08-8.08s3.64-8.08 8.08-8.08c2.4 0 4.2 1 5.48 2.24l2.32-2.32C19.04 2.52 16.12 1 12.48 1 6.24 1 1 6.24 1 12.48s5.24 11.48 11.48 11.48c3.36 0 6.12-1.12 8.32-3.44 2.2-2.2 2.88-5.32 2.88-8.04 0-.76-.08-1.48-.2-2.08h-11z"/>
                </svg>
              </div>
              <div>
                <p className="font-black text-slate-800 uppercase tracking-tighter text-sm">
                  {authenticated ? '✓ Account Google Connesso' : '⚠ Autenticazione Richiesta'}
                </p>
                <p className="text-xs text-slate-500">
                  {authenticated && userEmail ? userEmail : 'Non autorizzato - Clicca per collegare'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleAuth} 
              className={`px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-md ${
                authenticated 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-[#00adef] text-white hover:bg-[#009bd6] animate-pulse'
              }`}
            >
              {authenticated ? 'Disconnetti' : 'Connetti Google'}
            </button>
          </div>

          {/* Avviso se non autenticato */}
          {!authenticated && (
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-yellow-800">Autorizzazione Google richiesta</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Per utilizzare Drive, Sheets e Gmail devi prima autenticarti con il tuo account Google.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
              Identità e Drive
            </h4>
            <div className="grid gap-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  URL Logo (Link Drive o ID)
                </label>
                <input 
                  type="text" 
                  name="logoUrl" 
                  value={config.logoUrl} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="https://drive.google.com/file/d/... o solo ID" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  ID Cartella Radice (Drive)
                </label>
                <input 
                  type="text" 
                  name="rootFolderId" 
                  value={config.rootFolderId} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="19Xp9YhRRnLOGkolFWm0pBS2wI818KXVp"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  ID Google Sheet (Database)
                </label>
                <input 
                  type="text" 
                  name="spreadsheetId" 
                  value={config.spreadsheetId} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="1_CZj56b-FQxgfKM0uYGrRy65cLUPkbTL_3rwoRQytBE"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
              ID Template Documenti
            </h4>
            <div className="grid gap-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  ID Template CONTRATTO
                </label>
                <input 
                  type="text" 
                  name="templateContrattoId" 
                  value={config.templateContrattoId} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="1FK0xBomT9HMtKTtU1OshcXKTX5pGaTPnV8Vnp9XZYLM"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  ID Template MANUALE
                </label>
                <input 
                  type="text" 
                  name="templateManualeId" 
                  value={config.templateManualeId} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="1oU9hTwV7tswIRiXqGffUd02fz8jIKulPKmapKwgwFJU"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                  ID Template GARANZIA
                </label>
                <input 
                  type="text" 
                  name="templateGaranziaId" 
                  value={config.templateGaranziaId} 
                  onChange={handleChange} 
                  className="w-full border-2 border-slate-100 rounded-xl p-3 text-xs focus:border-[#00adef] outline-none font-mono" 
                  placeholder="1w8PFeu2f_yBT3sJdxz2vMIFizr8NH1Uprrk_RB0wHvA"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button 
              onClick={onSeed} 
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-[#00adef] hover:text-[#00adef] transition-all"
            >
              Genera 10 Record di Test (Sostituisce dati attuali)
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-2 text-xs font-bold text-slate-600 uppercase tracking-widest hover:text-slate-800"
          >
            Annulla
          </button>
          <button 
            onClick={handleSave} 
            className="px-10 py-2.5 bg-[#00adef] text-white text-xs font-black rounded-xl shadow-xl hover:bg-[#009bd6] transition-all uppercase tracking-widest"
          >
            Salva Config
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;