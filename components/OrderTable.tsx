
import React from 'react';
import { Order, OrderStatus } from '../types';

interface OrderTableProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  onPrint: (order: Order) => void;
  onEmailAction: (order: Order) => void;
  onViewWorkflow: (order: Order) => void;
  onToggleStatus: (id: string, current: OrderStatus) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onEdit, onDelete, onPrint, onEmailAction, onViewWorkflow, onToggleStatus }) => {
  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case OrderStatus.SOSPESO: return 'bg-yellow-100 text-yellow-800 border-yellow-300 shadow-yellow-100/50';
      case OrderStatus.IN_CORSO: return 'bg-orange-100 text-orange-800 border-orange-200';
      case OrderStatus.CONCLUSO: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Data</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Azienda / P.IVA</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Tipo</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Modello / Mat.</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Stato Iter</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                   <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      Nessun record trovato per questi criteri
                   </div>
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className={`${order.status === OrderStatus.SOSPESO ? 'bg-yellow-100/60' : 'hover:bg-slate-50'} transition-colors group`}>
                  <td className="px-6 py-4 font-bold text-slate-600 whitespace-nowrap">{order.dataInserimento}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 leading-tight uppercase tracking-tighter">{order.nomeAzienda}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{order.piva}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white uppercase tracking-tighter">
                      {order.tipoContratto}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="text-slate-800 font-bold">{order.modello}</span>
                       <span className="text-[10px] text-slate-500 font-bold">Mat: {order.matricola}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onViewWorkflow(order); }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest ${getStatusColor(order.status)} transition-all active:scale-95 flex items-center gap-2 shadow-sm`}
                      title="Gestisci Iter e Azioni"
                    >
                      {order.status}
                      <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onPrint(order)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-200 transition-all" title="Stampa">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      </button>
                      <button onClick={() => onEmailAction(order)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Email">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </button>
                      <button onClick={() => onEdit(order)} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Modifica">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(confirm('ATTENZIONE: Eliminare definitivamente questo record?')) onDelete(order.id); }}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="ELIMINA"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;
