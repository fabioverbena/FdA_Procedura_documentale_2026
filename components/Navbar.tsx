
import React from 'react';
import { AppConfig } from '../types';
import { getDirectLogoUrl } from '../services/googleService';

interface NavbarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  activeTab: 'dashboard' | 'new' | 'database';
  setTab: (tab: 'dashboard' | 'new' | 'database') => void;
  onOpenSettings: () => void;
  config: AppConfig;
}

const Navbar: React.FC<NavbarProps> = ({ searchTerm, onSearch, activeTab, setTab, onOpenSettings, config }) => {
  const logoUrl = getDirectLogoUrl(config.logoUrl);

  const handleSearchChange = (value: string) => {
    onSearch(value);
    if (value.trim() !== '' && activeTab !== 'database') {
      setTab('database');
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-10">
            <div onClick={() => setTab('dashboard')} className="cursor-pointer hover:opacity-80 transition-opacity">
              {logoUrl ? (
                <img src={logoUrl} alt="Fiordacqua" className="h-10 w-auto object-contain" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
              ) : null}
              {(!logoUrl) && (
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-[#00adef] text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-[#00adef]/20">FA</div>
                   <div className="flex flex-col -space-y-1">
                      <span className="font-black text-slate-900 tracking-tighter uppercase text-lg italic">FIORDACQUA</span>
                      <span className="text-[8px] font-bold text-[#00adef] tracking-[0.2em] uppercase">Procedura Documentale</span>
                   </div>
                </div>
              )}
            </div>

            <div className="hidden md:flex space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'new', label: 'Nuovo Ordine' },
                { id: 'database', label: 'Database' }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setTab(item.id as any)}
                  className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === item.id ? 'bg-[#00adef] text-white shadow-lg shadow-[#00adef]/20' : 'text-slate-400 hover:text-[#00adef] hover:bg-slate-50'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-1 max-w-md justify-end">
            <div className="relative group w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className={`h-4 w-4 transition-colors ${searchTerm ? 'text-[#00adef]' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                className="block w-full pl-11 pr-11 py-2.5 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:outline-none focus:bg-white focus:border-[#00adef] focus:ring-4 focus:ring-[#00adef]/5 sm:text-xs font-bold transition-all"
                placeholder="Cerca cliente, matricola o modello..."
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <button onClick={onOpenSettings} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
