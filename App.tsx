import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, DashboardStats, AppConfig } from './types';
import { getOrders, saveOrder, deleteOrder, updateOrderStatus, getConfig, seedTestData, generateSafeId } from './services/googleService';
import { handleOAuthCallback, isAuthenticated, sendEmail } from './services/googleAuth';
import DocumentiProntiModal from './components/DocumentiProntiModal';
import { AndgeneratePrintDocument, uploadFileToDrive, getOrCreateClientFolder } from './services/googleDriveService';import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderTable from './components/OrderTable';
import EmailModal from './components/EmailModal';
import PrintModal from './components/PrintModal';
import SettingsModal from './components/SettingsModal';
import DocumentoYouSignModal from './components/DocumentoYouSignModal';
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new' | 'database'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState<OrderStatus | 'TOTAL' | 'IN_CORSO_ONLY' | null>(null);
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [showDocumentiModal, setShowDocumentiModal] = useState(false);
  // Stati per modal documento YouSign
const [showDocumentoModal, setShowDocumentoModal] = useState(false);
const [documentoCorrente, setDocumentoCorrente] = useState<any>(null);
const [documentiPronti, setDocumentiPronti] = useState<any>(null);
const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [pendingEmailOrder, setPendingEmailOrder] = useState<{order: Order, forcedDoc?: 'contratto' | 'manuale' | 'garanzia'} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error'; sticky?: boolean; ack?: { key: string; value: string }; action?: 'go_database' } | null>(null);
  const LAST_STATUS_SNAPSHOT_KEY = 'fda_last_status_snapshot_2026';
  const LAST_STATUS_TOAST_AT_KEY = 'fda_last_status_toast_at_2026';
  const AUTH_REQUIRED_TOAST_AT_KEY = 'fda_auth_required_toast_at_2026';
  const ACTION_REQUIRED_TOAST_AT_KEY = 'fda_action_required_toast_at_2026';
  const ACTION_REQUIRED_ACK_SNAPSHOT_KEY = 'fda_action_required_ack_snapshot_2026';
  // Carica ordini all'avvio + polling automatico
  useEffect(() => {
    const urlHasToken = window.location.hash.includes('access_token');

    if (urlHasToken) {
      const success = handleOAuthCallback();
      if (success) {
        showToast('Autenticazione Google completata!', 'success', 6000);
        setTimeout(() => setIsSettingsOpen(true), 500);
      } else {
        showToast('Errore durante l\'autenticazione', 'error');
      }
    }

    loadOrders();

    const intervalId = setInterval(() => {
      console.log('🔄 Auto-refresh ordini');
      loadOrders();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
    // 🆕 Refresh quando torni alla tab database
    if (activeTab === 'database') {
      console.log('🔄 Refresh ordini (cambio tab)');
      loadOrders();
    }
  }, [activeTab]);
// Dopo gli altri useEffect (circa riga 50-80)

// Auto-completa iter quando garanzia firmata
useEffect(() => {
  const checkIterConcluso = async () => {
    const ordiniDaCompletare = orders.filter(
      order => order.status === 'Garanzia firmata' && order.workflow?.garanziaRilasciata
    );
    
    if (ordiniDaCompletare.length > 0) {
      console.log(`🎉 ${ordiniDaCompletare.length} ordini da completare automaticamente`);
      
      for (const order of ordiniDaCompletare) {
        const updatedOrder = {
          ...order,
          status: 'Iter concluso' as OrderStatus
        };
        await saveOrder(updatedOrder);
        console.log(`✅ Ordine ${order.id} → Iter concluso`);
      }
      
      await loadOrders();
    }
  };
  
  checkIterConcluso();
}, [orders]);  
  const loadOrders = async () => {
    try {
      const currentConfig = getConfig();
      if (currentConfig.spreadsheetId && !isAuthenticated()) {
        const lastToastAt = Number(localStorage.getItem(AUTH_REQUIRED_TOAST_AT_KEY) || '0');
        const now = Date.now();
        if (!lastToastAt || now - lastToastAt > 5 * 60 * 1000) {
          showToast('⚙️ Per vedere gli aggiornamenti automatici devi riconnettere Google (Impostazioni).', 'info');
          localStorage.setItem(AUTH_REQUIRED_TOAST_AT_KEY, String(now));
        }
      }

      const data = await getOrders();
      setOrders(data);

      try {
        const previousRaw = localStorage.getItem(LAST_STATUS_SNAPSHOT_KEY);
        const previous: Record<string, string> = previousRaw ? JSON.parse(previousRaw) : {};

        const changes = data.filter(o => previous[o.id] && previous[o.id] !== o.status);

        const actionRequiredOrders = data.filter(o => {
          const status = String(o.status);
          return status === 'Contratto firmato' || status === 'Manuale firmato';
        });

        if (actionRequiredOrders.length > 0) {
          const snapshot = JSON.stringify(
            actionRequiredOrders
              .map(o => ({ id: o.id, status: String(o.status) }))
              .sort((a, b) => a.id.localeCompare(b.id))
          );

          const lastAckSnapshot = localStorage.getItem(ACTION_REQUIRED_ACK_SNAPSHOT_KEY) || '';
          const lastActionToastAt = Number(localStorage.getItem(ACTION_REQUIRED_TOAST_AT_KEY) || '0');
          const now = Date.now();

          const shouldShowBecauseNew = snapshot !== lastAckSnapshot;
          const shouldShowBecauseTime = !lastActionToastAt || now - lastActionToastAt > 2 * 60 * 1000;

          if (shouldShowBecauseNew && shouldShowBecauseTime) {
            const first = actionRequiredOrders[0];
            const nextStepLabel = String(first.status) === 'Contratto firmato' ? 'inviare il Manuale' : 'inviare la Garanzia';
            showToast(
              `🟧 Azione richiesta: ${first.nomeAzienda} — puoi ${nextStepLabel}.`,
              'info',
              6000,
              true,
              { key: ACTION_REQUIRED_ACK_SNAPSHOT_KEY, value: snapshot },
              'go_database'
            );
            localStorage.setItem(ACTION_REQUIRED_TOAST_AT_KEY, String(now));
          }
        }

        if (changes.length > 0) {
          const lastToastAt = Number(localStorage.getItem(LAST_STATUS_TOAST_AT_KEY) || '0');
          const now = Date.now();

          if (!lastToastAt || now - lastToastAt > 5 * 60 * 1000) {
            showToast(
              `Aggiornamenti rilevati: ${changes.length} ordini hanno cambiato stato.`,
              'info',
              6000
            );
            localStorage.setItem(LAST_STATUS_TOAST_AT_KEY, String(now));
          }
        }

        const nextSnapshot: Record<string, string> = {};
        for (const o of data) nextSnapshot[o.id] = o.status;
        localStorage.setItem(LAST_STATUS_SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
      } catch (e) {
        console.warn('Impossibile calcolare aggiornamenti status:', e);
      }
    } catch (error) {
      console.error('Errore caricamento ordini:', error);
      showToast('Errore caricamento dati', 'error');
    }
  };

  const stats: DashboardStats = useMemo(() => {
    return {
      total: orders.length,
      sospesi: orders.filter(o => o.status === OrderStatus.SOSPESO).length,
      conclusi: orders.filter(o => o.status === 'Iter concluso').length,  // ✅ Fix maiuscola
    inCorso: orders.filter(o => o.status !== 'Iter concluso').length,   // ✅ Fix maiuscola
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    if (currentFilter === 'IN_CORSO_ONLY') {
      // Mostra TUTTI tranne "Iter concluso"
      result = result.filter(o => o.status !== 'Iter concluso');
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

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success',
    durationMs: number = 3000,
    sticky: boolean = false,
    ack?: { key: string; value: string },
    action?: 'go_database'
  ) => {
    setToast({ message, type, sticky, ack, action });
    if (!sticky) {
      setTimeout(() => setToast(null), durationMs);
    }
  };

  const dismissToast = () => {
    if (toast?.ack) {
      try {
        localStorage.setItem(toast.ack.key, toast.ack.value);
      } catch (e) {
        console.warn('Impossibile salvare ack toast:', e);
      }
    }
    setToast(null);
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
  const handleContinuaProcedura = async (order: Order) => {
    const cleanPIVA = order.piva.replace(/\s/g, '');
    
    setIsGeneratingDocs(true);
    
    try {
      // Determina quale documento generare
      const docType = order.status === 'Manuale firmato' ? 'garanzia' : 'manuale';
      const docLabel = docType === 'garanzia' ? 'Garanzia' : 'Manuale';
      const newStatus = docType === 'garanzia' ? 'Garanzia inviata' : 'Manuale inviato';
      
      console.log(`🔄 Generazione ${docLabel} in corso...`);
      
      // Se la cartella non esiste, creala ora
      let clientFolderId = order.clientFolderId;
      
      if (!clientFolderId) {
        console.log('📁 Cartella non trovata, la creo ora...');
        const folders = await getOrCreateClientFolder(
          order.nomeAzienda,
          order.piva
        );
        
        if (!folders) {
          alert('❌ Errore durante la creazione delle cartelle su Drive');
          return;
        }
        
        clientFolderId = folders.clientFolderId;
        console.log('✅ Cartelle create:', folders);
        
        // SALVA l'ID cartella nell'ordine
        order.clientFolderId = folders.clientFolderId;
        order.firmatiFolderId = folders.firmatiFolderId;
        
        // AGGIORNA nel database
        await saveOrder(order);
        console.log('💾 ID cartelle salvati nell\'ordine');
        
        // RICARICA ordini per aggiornare la UI
        const updatedOrders = await getOrders();
        setOrders(updatedOrders);
      }
      
      // GENERA DOCUMENTO
      const documentResult = await AndgeneratePrintDocument(order, docType);
      
      if (!documentResult) {
        throw new Error(`Errore generazione ${docLabel}`);
      }
      
      const documentBlob = await fetch(`data:application/pdf;base64,${documentResult.base64}`)
        .then(r => r.blob());
      
      const documentFilename = `${docLabel} CE - ${cleanPIVA}.pdf`;
      const documentUrl = await uploadFileToDrive(
        documentBlob,
        documentFilename,
        clientFolderId
      );
      
      if (!documentUrl) {
        throw new Error(`Errore salvataggio ${docLabel} su Drive`);
      }
      
      console.log(`✅ ${docLabel} generato:`, documentUrl);
      
      // AGGIORNA STATUS ORDINE
      const updatedOrder = {
        ...order,
        status: newStatus as OrderStatus,
        workflow: {
          ...order.workflow,
          manualeInviato: docType === 'manuale' ? true : order.workflow.manualeInviato,
          garanziaRilasciata: docType === 'garanzia' ? true : order.workflow.garanziaRilasciata
        }
      };
      
      await saveOrder(updatedOrder);
      await loadOrders();
      
      console.log(`💾 Status aggiornato a "${newStatus}"`);
      
      // PREPARA DOCUMENTO PER MODAL
      setDocumentoCorrente({
        tipo: `${docLabel} CE`,
        url: documentUrl,
        filename: documentFilename,
        cliente: order.nomeAzienda,
        firmatario: order.rappresentanteLegale || order.nomeAzienda,
        email: order.email || '',
        cellulare: order.telefono || ''
      });
      
      // APRI MODAL
      setShowDocumentoModal(true);
      
      alert(`✅ ${docLabel} generato con successo!`);
      
    } catch (error) {
      console.error('❌ Errore durante generazione documento:', error);
      alert(`❌ Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setIsGeneratingDocs(false);
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
      } if (updatedOrder.workflow.garanziaRilasciata) {
  updatedOrder.status = OrderStatus.CONCLUSO;
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
    const result = await generateAndPrintDocument(printingOrder, documentType);
    
    if (result) {
      // Scarica il PDF
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      
      URL.revokeObjectURL(url);
      
      showToast('PDF scaricato!', 'success');
    }
    
    setPrintingOrder(null);
  } catch (error: any) {
    console.error('Errore generazione:', error);
    showToast(error.message || 'Errore', 'error');
  } finally {
    setIsLoading(false);
  }
};
const handleSubmit = async (order: Partial<Order>, source: 'manual' | 'yousign') => {
  try {
    if (editingOrder) {
      // Modifica ordine esistente
      const updatedOrder = { ...editingOrder, ...order };
      await saveOrder(updatedOrder);
      showToast('✅ Ordine aggiornato!', 'success');
    } else {
      // Nuovo ordine
      const newOrder = {
        ...order,
        id: generateSafeId(),
        dataInserimento: new Date().toISOString(),
        status: source === 'yousign' ? 'In attesa firma' : OrderStatus.IN_CORSO
      } as Order;
      await saveOrder(newOrder);
      showToast('✅ Ordine creato!', 'success');
    }
    
    // Ricarica ordini
    const updatedOrders = await getOrders();
    setOrders(updatedOrders);
    
    // Chiudi form e torna al database
    setEditingOrder(null);
    setActiveTab('database');
    
  } catch (error) {
    console.error('❌ Errore salvataggio ordine:', error);
    showToast('❌ Errore durante il salvataggio', 'error');
  }
};
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* 🎨 WATERMARK LOGO SFUMATO */}
     <div className="fixed inset-0 pointer-events-none z-[5] flex items-center justify-center">
  <img 
    src="/logo.jpg" 
    alt="" 
    className="w-[1200px] h-auto opacity-[0.25] mt-32"
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
           initialData={editingOrder || undefined}
           onSubmit={handleSubmit}
           onCancel={() => { setEditingOrder(null); setActiveTab('database'); }}
           onDocumentoReady={(doc) => {
             setDocumentoCorrente(doc);
             setShowDocumentoModal(true);
           }}
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
                onContinuaProcedura={handleContinuaProcedura}  
                isGeneratingDocs={isGeneratingDocs}  
              />
            </div>
          )}
        </main>

        {toast && (
          <div
            onClick={() => {
              if (toast.action === 'go_database') {
                setActiveTab('database');
              }
            }}
            className={`fixed bottom-8 right-8 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-10 font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border-2 ${
            toast.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 
            toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
            'bg-[#00adef] border-[#009bd6] text-white'
          } ${toast.action ? 'cursor-pointer' : ''}`}
          >
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            <span className="max-w-[420px]">{toast.message}</span>

            {toast.sticky && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast();
                }}
                className="ml-2 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 border border-white/20 transition"
              >
                OK
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast();
              }}
              className="ml-1 p-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition"
              title="Chiudi"
            >
              ✕
            </button>
          </div>
        )}

        {isSettingsOpen && (
          <SettingsModal 
            onSave={handleSaveConfig} 
            onClose={() => setIsSettingsOpen(false)} 
            onSeed={handleSeedData} 
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
      {/* Vecchio modal (da rimuovere dopo test) */}
{/* <DocumentiProntiModal
  show={showDocumentiModal}
  onClose={() => setShowDocumentiModal(false)}
  documenti={documentiPronti}
/> */}

{/* Nuovo modal */}
<DocumentoYouSignModal
  show={showDocumentoModal}
  onClose={() => {
    setShowDocumentoModal(false);
    setDocumentoCorrente(null);
  }}
  documento={documentoCorrente}
/>
{/* Loading Overlay - Generazione Documenti */}
{isGeneratingDocs && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4 max-w-md">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          📄 Generazione documento...
        </h3>
        <p className="text-sm text-gray-600">
          Attendere qualche secondo
        </p>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default App;
