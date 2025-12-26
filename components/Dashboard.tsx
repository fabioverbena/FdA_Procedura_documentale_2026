
import React from 'react';
import { DashboardStats, OrderStatus, AppConfig } from '../types';
import { getDirectLogoUrl } from '../services/googleService';

interface DashboardProps {
  stats: DashboardStats;
  onFilterStatus: (status: OrderStatus | 'TOTAL' | 'IN_CORSO_ONLY') => void;
  onStartTest: () => void;
  config: AppConfig;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onFilterStatus, onStartTest, config }) => {
  const logoUrl = getDirectLogoUrl(config.logoUrl);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Box Ordini Totali */}
        <div onClick={() => onFilterStatus('TOTAL')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border-t-4 border-t-slate-800">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Totali</p>
          <p className="text-5xl font-black text-slate-900 mt-2 tracking-tighter">{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-tight italic">Tutti i record 2026</p>
        </div>

        {/* Box Contratti Gestiti (In Corso) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-[#00adef] flex flex-col justify-between group cursor-pointer" onClick={() => onFilterStatus(OrderStatus.IN_CORSO)}>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-[#00adef]">In Corso</p>
            <p className="text-5xl font-black text-[#00adef] mt-2 tracking-tighter">{stats.inCorso}</p>
          </div>
          {stats.conclusi < stats.total && (
            <button 
              onClick={(e) => { e.stopPropagation(); onFilterStatus('IN_CORSO_ONLY'); }}
              className="mt-6 w-full py-2 bg-[#00adef]/10 text-[#00adef] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#00adef] hover:text-white transition-all shadow-sm"
            >
              Mostra in Corso
            </button>
          )}
        </div>

        {/* Box Sospesi - LA LABEL MANCANTE */}
        <div onClick={() => onFilterStatus(OrderStatus.SOSPESO)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border-t-4 border-t-yellow-400">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-yellow-600">Sospesi</p>
          <p className="text-5xl font-black text-yellow-500 mt-2 tracking-tighter">{stats.sospesi}</p>
          <p className="text-[10px] text-yellow-600 mt-4 font-bold uppercase tracking-tight italic">In attesa di sblocco</p>
        </div>

        {/* Box Iter Concluso */}
        <div onClick={() => onFilterStatus(OrderStatus.CONCLUSO)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border-t-4 border-t-green-500">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-green-600">Conclusi</p>
          <p className="text-5xl font-black text-green-600 mt-2 tracking-tighter">{stats.conclusi}</p>
          <p className="text-[10px] text-green-600 mt-4 font-bold uppercase tracking-tight italic">Garanzie evase</p>
        </div>
      </div>

      <div className="bg-slate-900 p-12 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="bg-white p-6 rounded-3xl shadow-2xl transition-transform group-hover:rotate-3 duration-500 min-w-[140px] flex items-center justify-center overflow-hidden h-32 w-48">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Fiordacqua" 
                className="max-h-full max-w-full object-contain animate-in zoom-in duration-300" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=Logo+FA';
                }} 
              />
            ) : (
              <div className="w-20 h-20 bg-[#00adef] text-white flex items-center justify-center text-4xl font-black rounded-2xl italic">FA</div>
            )}
          </div>
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-tight">CONSOLE OPERATIVA <span className="text-[#00adef] not-italic">FIORDACQUA</span></h2>
            <p className="mt-4 text-slate-400 max-w-2xl text-lg font-medium leading-relaxed">
              Gestione documentale e flussi automatizzati per il 2026. Sincronizzazione Drive/Sheets attiva.
            </p>
            <div className="mt-8">
               <button 
                  onClick={onStartTest} 
                  className="px-10 py-4 bg-[#00adef] text-white font-black rounded-2xl shadow-lg shadow-[#00adef]/20 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-3 border-2 border-transparent hover:border-white/20"
               >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Genera 10 Record di Test
               </button>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-[#00adef]/5 skew-x-12 transform translate-x-1/2"></div>
      </div>
    </div>
  );
};

export default Dashboard;
