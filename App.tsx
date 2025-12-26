
import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, DashboardStats, AppConfig } from './types';
import { getOrders, saveOrder, deleteOrder, updateOrderStatus, getConfig, seedTestData, generateSafeId } from './services/googleService';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderTable from './components/OrderTable';
import WorkflowModal from './components/WorkflowModal';
import EmailModal from './components/EmailModal';
import PrintModal from './components/PrintModal';
import SettingsModal from './components/SettingsModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new' | 'database'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState<OrderStatus | 'TOTAL' | 'IN_CORSO_ONLY' | null>(null);
  const [config, setConfig] = useState<AppConfig>(getConfig());
  
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [pendingEmailOrder, setPendingEmailOrder] = useState<{order: Order, forcedDoc?: 'contratto' | 'manuale' | 'garanzia'} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    setOrders(getOrders());
  }, [activeTab]);

  const stats: DashboardStats = useMemo(() => {
    return {
      total: orders.length,
      sospesi: orders.filter(o => o.status === OrderStatus.SOSPESO).length,
      conclusi: orders.filter(o => o.status === OrderStatus.CONCLUSO).length,
      inCorso: orders.filter(o => o.status === OrderStatus.IN_CORSO).length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    // Filtri di stato dalla Dashboard
    if (currentFilter === 'IN_CORSO_ONLY') {
      result = result.filter(o => o.status === OrderStatus.IN_CORSO);
    } else if (currentFilter && currentFilter !== 'TOTAL') {
      result = result.filter(o => o.status === currentFilter);
    }
    
    // Ricerca globale (Azienda, PIVA, Modello, Matricola, Tipo Contratto)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(o => 
        o.nomeAzienda.toLowerCase().includes(term) ||
        o.piva.toLowerCase().includes(term) ||
        o.modello.toLowerCase().includes(term) ||
        o.matricola.toLowerCase().includes(term) ||
        o.tipoContratto.toLowerCase().includes(term)
      );
    }
    return result.sort((a, b) => new Date(b.dataInserimento).getTime() - new Date(a.dataInserimento).getTime());
  }, [orders, searchTerm, currentFilter]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFilterFromDashboard = (status: OrderStatus | 'TOTAL' | 'IN_CORSO_ONLY') => {
    setCurrentFilter(status);
    setActiveTab('database');
  };

  const handleCreateOrUpdate = async (data: Partial<Order>, action: 'save' | 'print' | 'email') => {
    setIsLoading(true);
    const orderData = {
      ...data,
      id: data.id || generateSafeId(),
      status: data.status || OrderStatus.IN_CORSO,
      workflow: data.workflow || {
        contrattoInviato: action === 'email',
        contrattoFirmato: false,
        manualeInviato: false,
        manualeFirmato: false,
        garanziaRilasciata: false
      }
    } as Order;

    await saveOrder(orderData);
    const updated = getOrders();
    setOrders(updated);
    setEditingOrder(null);
    setActiveTab('database');
    
    showToast(`Ordine ${orderData.nomeAzienda} salvato.`);
    
    if (action === 'email') setPendingEmailOrder({ order: orderData, forcedDoc: 'contratto' });
    else if (action === 'print') setPrintingOrder(orderData);
    setIsLoading(false);
  };

  const handleToggleManualStatus = (id: string, current: OrderStatus) => {
    const nextStatus = current === OrderStatus.SOSPESO ? OrderStatus.IN_CORSO : OrderStatus.SOSPESO;
    updateOrderStatus(id, nextStatus);
    const updated = getOrders();
    setOrders(updated);
    
    showToast(nextStatus === OrderStatus.SOSPESO ? "Ordine SOSPESO" : "Iter RIPRESO", 'info');

    const updatedOrder = updated.find(o => o.id === id);
    if (viewingWorkflow && updatedOrder) setViewingWorkflow(updatedOrder);
  };

  const handleUpdateWorkflow = async (id: string, workflow: Order['workflow']) => {
    const order = orders.find(o => o.id === id);
    if (order) {
      const isFinishing = workflow.garanziaRilasciata && order.status !== OrderStatus.CONCLUSO;
      const newStatus = workflow.garanziaRilasciata ? OrderStatus.CONCLUSO : order.status;
      const updatedOrder = { ...order, workflow, status: newStatus };
      await saveOrder(updatedOrder);
      const updated = getOrders();
      setOrders(updated);
      setViewingWorkflow(updated.find(o => o.id === id) || null);
      showToast(isFinishing ? "Iter CONCLUSO con successo!" : "Avanzamento registrato");
    }
  };

  const handleContinueWorkflow = (order: Order, forcedDocType?: 'contratto' | 'manuale' | 'garanzia') => {
    setViewingWorkflow(null);
    setPendingEmailOrder({ order, forcedDoc: forcedDocType });
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    showToast("Configurazione salvata");
  };

  const handleSeedData = () => {
    setIsLoading(true);
    setTimeout(() => {
      const newOrders = seedTestData();
      setOrders(newOrders);
      setIsLoading(false);
      showToast("Database Test Inizializzato!", 'success');
    }, 600);
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminare definitivamente questo record?')) {
      deleteOrder(id);
      setOrders(getOrders());
      showToast("Record eliminato", 'info');
    }
  };

  const handleSendEmail = async (content: string, docs: string[]) => {
    if (!pendingEmailOrder) return;
    
    setIsLoading(true);
    const { order } = pendingEmailOrder;
    
    const newWorkflow = { ...order.workflow };
    if (docs.includes('contratto')) newWorkflow.contrattoInviato = true;
    if (docs.includes('manuale')) newWorkflow.manualeInviato = true;
    if (docs.includes('garanzia')) newWorkflow.garanziaRilasciata = true;

    const newStatus = newWorkflow.garanziaRilasciata ? OrderStatus.CONCLUSO : OrderStatus.IN_CORSO;
    const updatedOrder = { ...order, workflow: newWorkflow, status: newStatus };
    
    await saveOrder(updatedOrder);
    setOrders(getOrders());
    setPendingEmailOrder(null);
    setIsLoading(false);
    showToast("Documentazione inviata con successo!");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar activeTab={activeTab} setTab={setActiveTab} searchTerm={searchTerm} onSearch={setSearchTerm} onOpenSettings={() => setIsSettingsOpen(true)} config={config} />

      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-grow">
        {activeTab === 'dashboard' && <Dashboard stats={stats} onFilterStatus={handleFilterFromDashboard} onStartTest={handleSeedData} config={config} />}
        {activeTab === 'new' && <OrderForm initialData={editingOrder} onSubmit={handleCreateOrUpdate} onCancel={() => { setActiveTab('dashboard'); setEditingOrder(null); }} />}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">DATABASE <span className="text-[#00adef]">ORDINI</span></h2>
               {currentFilter && (
                 <button onClick={() => setCurrentFilter(null)} className="text-[10px] font-black text-[#00adef] uppercase tracking-widest flex items-center gap-2 border-2 border-[#00adef] px-4 py-1.5 rounded-2xl hover:bg-[#00adef] hover:text-white transition-all bg-white shadow-md">
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                   Reset Filtro
                 </button>
               )}
            </div>
            <OrderTable orders={filteredOrders} onEdit={(o) => { setEditingOrder(o); setActiveTab('new'); }} onDelete={handleDelete} onPrint={setPrintingOrder} onEmailAction={(o) => setPendingEmailOrder({order: o})} onViewWorkflow={setViewingWorkflow} onToggleStatus={handleToggleManualStatus} />
          </div>
        )}
      </main>

      {toast && (
        <div className={`fixed bottom-8 right-8 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-10 font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border-2 ${toast.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-900 border-slate-700 text-white'}`}>
          <div className={`${toast.type === 'success' ? 'bg-white text-green-600' : 'bg-[#00adef] text-white'} rounded-full p-1`}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
          </div>
          {toast.message}
        </div>
      )}

      {isSettingsOpen && <SettingsModal onSave={handleSaveConfig} onClose={() => setIsSettingsOpen(false)} onSeed={handleSeedData} />}
      {viewingWorkflow && <WorkflowModal order={viewingWorkflow} onUpdateWorkflow={handleUpdateWorkflow} onContinue={handleContinueWorkflow} onToggleStatus={handleToggleManualStatus} onClose={() => setViewingWorkflow(null)} />}
      {printingOrder && <PrintModal order={printingOrder} onClose={() => setPrintingOrder(null)} />}
      {pendingEmailOrder && <EmailModal order={pendingEmailOrder.order} forcedDocType={pendingEmailOrder.forcedDoc} onSend={handleSendEmail} onClose={() => setPendingEmailOrder(null)} />}

      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white text-center">
           <div className="w-16 h-16 border-4 border-[#00adef] border-t-transparent rounded-full animate-spin"></div>
           <p className="mt-6 font-black uppercase tracking-widest text-xs">Sincronizzazione Cloud...</p>
        </div>
      )}
    </div>
  );
};

export default App;
