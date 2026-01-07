import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, DashboardStats, AppConfig } from './types';
import { getOrders, saveOrder, deleteOrder, updateOrderStatus, getConfig, seedTestData, generateSafeId } from './services/googleService';
import { handleOAuthCallback, isAuthenticated, sendEmail } from './services/googleAuth';
import { generateAndPrintDocument } from './services/googleDriveService';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    const urlHasToken = window.location.hash.includes('access_token');
    
    if (urlHasToken) {
      const success = handleOAuthCallback();
      if (success) {
        showToast('Autenticazione Google completata!', 'success');
        setTimeout(() => setIsSettingsOpen(true), 500);
      } else {
        showToast('Errore durante l\'autenticazione', 'error');
      }
    }
    
    loadOrders();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.error('Errore caricamento ordini:', error);
      showToast('Errore caricamento dati', 'error');
    }
  };

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
    
    if (currentFilter === 'IN_CORSO_ONLY') {
      result = result.filter(o => o.status === OrderStatus.IN_CORSO);
    } else if (currentFilter && currentFilter !== 'TOTAL') {
      result = result.filter(o => o.status === currentFilter);
    }
    
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

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFilterFromDashboard = (status: OrderStatus | 'TOTAL' | 'IN_CORSO_ONLY') => {
    setCurrentFilter(status);
    setActiveTab('database');
  };

  const handleCreateOrUpdate = async (data: Partial<Order>, action: 'save' | 'print' | 'email') => {
    if ((action === 'email' || action === 'print') && !isAuthenticated()) {
      showToast('Effettua il login Google per usare questa funzione', 'error');
      setIsSettingsOpen(true);
      return;
    }

    setIsLoading(true);
    try {
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
      await loadOrders();
      setEditingOrder(null);
      setActiveTab('database');
      
      showToast(`Ordine ${orderData.nomeAzienda} salvato.`);
      
      if (action === 'email') {
        setPendingEmailOrder({ order: orderData, forcedDoc: 'contratto' });
      } else if (action === 'print') {
        setPrintingOrder(orderData);
      }
    } catch (error) {
      console.error('Errore salvataggio ordine:', error);
      showToast('Errore salvataggio ordine', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleManualStatus = async (id: string, current: OrderStatus) => {
    const nextStatus = current === OrderStatus.SOSPESO ? OrderStatus.IN_CORSO : OrderStatus.SOSPESO;
    try {
      await updateOrderStatus(id, nextStatus);
      await loadOrders();
      
      showToast(nextStatus === OrderStatus.SOSPESO ? "Ordine SOSPESO" : "Iter RIPRESO", 'info');

      const updated = await getOrders();
      const updatedOrder = updated.find(o => o.id === id);
      if (viewingWorkflow && updatedOrder) setViewingWorkflow(updatedOrder);
    } catch (error) {
      console.error('Errore cambio stato:', error);
      showToast('Errore cambio stato', 'error');
    }
  };

  const handleUpdateWorkflow = async (id: string, workflow: Order['workflow']) => {
    console.log('🔵 handleUpdateWorkflow chiamato:', { id, workflow });
    
    const order = orders.find(o => o.id === id);
    console.log('🔵 Ordine trovato:', order);
    
    if (order) {
      try {
        const isFinishing = workflow.garanziaRilasciata && order.status !== OrderStatus.CONCLUSO;
        const newStatus = workflow.garanziaRilasciata ? OrderStatus.CONCLUSO : order.status;
        const updatedOrder = { ...order, workflow, status: newStatus };
        
        console.log('🔵 Salvando ordine aggiornato:', updatedOrder);
        
        await saveOrder(updatedOrder);
        
        console.log('✅ Ordine salvato!');
        
        await loadOrders();
        
        const updated = await getOrders();
        const refreshed = updated.find(o => o.id === id);
        
        console.log('🔵 Ordine ricaricato:', refreshed);
        
        setViewingWorkflow(refreshed || null);
        showToast(isFinishing ? "Iter CONCLUSO con successo!" : "Avanzamento registrato");
      } catch (error) {
        console.error('❌ Errore aggiornamento workflow:', error);
        showToast('Errore aggiornamento workflow', 'error');
      }
    } else {
      console.error('❌ Ordine non trovato con id:', id);
    }
  };

  const handleContinueWorkflow = (order: Order, forcedDocType?: 'contratto' | 'manuale' | 'garanzia') => {
    if (!isAuthenticated()) {
      showToast('Effettua il login Google per continuare', 'error');
      setIsSettingsOpen(true);
      return;
    }
    setViewingWorkflow(null);
    setPendingEmailOrder({ order, forcedDoc: forcedDocType });
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    showToast("Configurazione salvata");
  };

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      const newOrders = await seedTestData();
      setOrders(newOrders);
      showToast("Database Test Inizializzato!", 'success');
    } catch (error) {
      console.error('Errore generazione test data:', error);
      showToast('Errore generazione dati di test', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Eliminare definitivamente questo record?')) {
      try {
        await deleteOrder(id);
        await loadOrders();
        showToast("Record eliminato", 'info');
      } catch (error) {
        console.error('Errore eliminazione:', error);
        showToast('Errore eliminazione record', 'error');
      }
    }
  };

  const handleTabChange = (tab: 'dashboard' | 'new' | 'database') => {
    if (tab === 'new' && editingOrder !== null) {
      console.log('🔵 Reset editingOrder per nuovo ordine');
      setEditingOrder(null);
    }
    setActiveTab(tab);
  };

  const handleSendEmail = async (content: string, docs: string[]) => {
    if (!pendingEmailOrder) return;
    
    if (!isAuthenticated()) {
      showToast('Sessione scaduta. Rieffettua il login', 'error');
      setIsSettingsOpen(true);
      return;
    }

    const { order } = pendingEmailOrder;
    setIsLoading(true);

    try {
      console.log('📧 Inizio processo invio email con PDF allegato...');

      const docType = docs[0] as 'contratto' | 'ddt' | 'fattura' | 'ordine' | 'installazione';
      
      console.log('📄 Generazione PDF da template:', docType);
      showToast('Generazione PDF in corso...', 'info');
      
      const pdfResult = await generateAndPrintDocument(order, docType);
      
      if (!pdfResult) {
        throw new Error('Errore generazione PDF da template Google Docs');
      }

      console.log('✅ PDF generato:', pdfResult.filename);

      const attachment = {
        filename: pdfResult.filename,
        mimeType: 'application/pdf',
        data: pdfResult.base64
      };

      const docLabels: Record<string, string> = {
        'contratto': 'Contratto di Vendita',
        'ddt': 'Documento di Trasporto',
        'fattura': 'Fattura',
        'ordine': 'Ordine Fornitore',
        'installazione': 'Report Installazione',
        'manuale': 'Manuale Operativo',
        'garanzia': 'Certificato di Garanzia'
      };

      const subject = `Fiordacqua - ${docLabels[docType] || docType} - ${order.nomeAzienda}`;

      console.log('📧 Invio email a:', order.emailContatto);
      showToast('Invio email in corso...', 'info');
      
      const emailSent = await sendEmail(
        order.emailContatto,
        subject,
        content,
        [attachment]
      );

      if (!emailSent) {
        throw new Error('Errore invio email tramite Gmail API');
      }

      console.log('✅ Email inviata con successo!');

      const updatedOrder = { ...order };

      if (docType === 'contratto') {
        updatedOrder.workflow.contrattoInviato = true;
      } else if (docType === 'manuale') {
        updatedOrder.workflow.manualeInviato = true;
      } else if (docType === 'garanzia') {
        updatedOrder.workflow.garanziaRilasciata = true;
      }

      await saveOrder(updatedOrder);
      console.log('✅ Stato ordine aggiornato');
      
      await loadOrders();
      setPendingEmailOrder(null);
      
      showToast('✅ Email inviata con successo con allegato PDF!', 'success');
      
      console.log('🎉 Processo completato con successo!');

    } catch (error: any) {
      console.error('❌ Errore durante il processo:', error);
      
      let errorMessage = 'Errore durante l\'invio dell\'email';
      
      if (error.message?.includes('Token')) {
        errorMessage = 'Sessione scaduta. Rieffettua il login.';
        setIsSettingsOpen(true);
      } else if (error.message?.includes('PDF')) {
        errorMessage = 'Errore generazione PDF: ' + error.message;
      } else if (error.message?.includes('email')) {
        errorMessage = 'Errore invio email: ' + error.message;
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintDocument = async (documentType: 'contratto' | 'manuale' | 'garanzia') => {
    if (!printingOrder) return;

    if (!isAuthenticated()) {
      showToast('Effettua il login Google per generare documenti', 'error');
      setIsSettingsOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      await generateAndPrintDocument(printingOrder, documentType);
      
      showToast(`${documentType.toUpperCase()} generato e scaricato!`, 'success');
      
      setPrintingOrder(null);
    } catch (error: any) {
      console.error('Errore generazione documento:', error);
      showToast(error.message || 'Errore generazione documento', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* 🎨 WATERMARK LOGO SFUMATO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center">
        <img 
          src="/logo.jpg" 
          alt="" 
          className="w-[900px] h-auto opacity-[0.30] blur-[2px]"
        />
      </div>
      
      {/* Contenuto sopra il watermark */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar 
          activeTab={activeTab} 
          setTab={handleTabChange}
          searchTerm={searchTerm} 
          onSearch={setSearchTerm} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          config={config} 
        />

        <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-grow">
          {activeTab === 'dashboard' && (
            <Dashboard 
              stats={stats} 
              onFilterStatus={handleFilterFromDashboard} 
              onStartTest={handleSeedData} 
              config={config} 
            />
          )}
          {activeTab === 'new' && (
            <OrderForm 
              initialData={editingOrder} 
              onSubmit={handleCreateOrUpdate} 
              onCancel={() => { setActiveTab('dashboard'); setEditingOrder(null); }} 
            />
          )}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">
                   DATABASE <span className="text-[#00adef]">ORDINI 2026</span>
                 </h2>
                 {currentFilter && (
                   <button 
                     onClick={() => setCurrentFilter(null)} 
                     className="text-[10px] font-black text-[#00adef] uppercase tracking-widest flex items-center gap-2 border-2 border-[#00adef] px-4 py-1.5 rounded-2xl hover:bg-[#00adef] hover:text-white transition-all bg-white shadow-md"
                   >
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                     Reset Filtro
                   </button>
                 )}
              </div>
              <OrderTable 
                orders={filteredOrders} 
                onEdit={(o) => { setEditingOrder(o); setActiveTab('new'); }} 
                onDelete={handleDelete} 
                onPrint={setPrintingOrder} 
                onEmailAction={(o) => setPendingEmailOrder({order: o})} 
                onViewWorkflow={setViewingWorkflow} 
                onToggleStatus={handleToggleManualStatus} 
              />
            </div>
          )}
        </main>

        {toast && (
          <div className={`fixed bottom-8 right-8 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-10 font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border-2 ${
            toast.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 
            toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
            'bg-slate-900 border-slate-700 text-white'
          }`}>
            <div className={`${
              toast.type === 'success' ? 'bg-white text-green-600' : 
              toast.type === 'error' ? 'bg-white text-red-600' :
              'bg-[#00adef] text-white'
            } rounded-full p-1`}>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
               </svg>
            </div>
            {toast.message}
          </div>
        )}

        {isSettingsOpen && (
          <SettingsModal 
            onSave={handleSaveConfig} 
            onClose={() => setIsSettingsOpen(false)} 
            onSeed={handleSeedData} 
          />
        )}
        {viewingWorkflow && (
          <WorkflowModal 
            order={viewingWorkflow} 
            onUpdateWorkflow={handleUpdateWorkflow} 
            onContinue={handleContinueWorkflow} 
            onToggleStatus={handleToggleManualStatus} 
            onClose={() => setViewingWorkflow(null)} 
          />
        )}
        {printingOrder && (
          <PrintModal 
            order={printingOrder} 
            onClose={() => setPrintingOrder(null)}
            onPrint={handlePrintDocument}
          />
        )}
        {pendingEmailOrder && (
          <EmailModal 
            order={pendingEmailOrder.order} 
            forcedDocType={pendingEmailOrder.forcedDoc} 
            onSend={handleSendEmail} 
            onClose={() => setPendingEmailOrder(null)} 
          />
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white text-center">
             <div className="w-16 h-16 border-4 border-[#00adef] border-t-transparent rounded-full animate-spin"></div>
             <p className="mt-6 font-black uppercase tracking-widest text-xs">Sincronizzazione Cloud...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
