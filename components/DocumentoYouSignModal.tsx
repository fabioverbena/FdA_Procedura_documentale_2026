import React, { useState, useEffect } from 'react';

interface DocumentoYouSignModalProps {
  show: boolean;
  onClose: () => void;
  documento: {
    tipo: string;  // "Contratto CE", "Manuale CE", "Garanzia CE"
    url: string;
    filename: string;
    cliente: string;
    firmatario: string;
    email: string;
    cellulare: string;
  } | null;
}

const DocumentoYouSignModal: React.FC<DocumentoYouSignModalProps> = ({ 
  show, 
  onClose, 
  documento 
}) => {
  const [username, setUsername] = useState('');

  useEffect(() => {
    let savedUsername = localStorage.getItem('fda_username');
    
    if (!savedUsername) {
      savedUsername = prompt(
        '🖥️ CONFIGURAZIONE INIZIALE\n\n' +
        'Per mostrarti il path corretto dei file scaricati,\n' +
        'inserisci il tuo nome utente Windows.\n\n' +
        '📍 Lo trovi qui: C:\\Users\\[IL TUO USERNAME]\\Downloads\n\n' +
        'Esempio: fabio, leonardo, admin, ecc.',
        'User'
      ) || 'User';
      
      localStorage.setItem('fda_username', savedUsername.trim());
    }
    
    setUsername(savedUsername);
  }, []);

  if (!show || !documento) return null;

  // Rileva sistema operativo
  const isWindows = navigator.platform.includes('Win');
  
  // Path stimato
  const downloadPath = isWindows 
    ? `C:\\Users\\${username}\\Downloads\\${documento.filename}`
    : `~/Downloads/${documento.filename}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert(`✅ ${label} copiato!`);
      })
      .catch(err => {
        console.error('Errore copia:', err);
        alert('❌ Errore durante la copia');
      });
  };

  const scaricaPDF = () => {
    // Forza download usando export di Google Drive
    const downloadUrl = documento.url.includes('/view') 
      ? documento.url.replace('/view', '/export?format=pdf')
      : documento.url + '?export=download';
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = documento.filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      alert('✅ PDF in download! Controlla la cartella Downloads.');
    }, 1000);
  };

  const apriYouSign = () => {
    window.open('https://yousign.app', '_blank');
  };

  // Colore dinamico in base al tipo
  const getColor = () => {
    if (documento.tipo.includes('Contratto') || documento.tipo.includes('Accordo')) {
      return 'purple';
    }
    if (documento.tipo.includes('Manuale')) {
      return 'blue';
    }
    if (documento.tipo.includes('Garanzia')) {
      return 'green';
    }
    return 'gray';
  };

  const color = getColor();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            📄 {documento.tipo}
          </h2>
          <p className="text-gray-600">
            Cliente: <strong>{documento.cliente}</strong>
          </p>
        </div>
        
        {/* Sezione Download */}
        <div className={`bg-${color}-50 border-2 border-${color}-200 rounded-lg p-4 mb-4`}>
          <h3 className="text-lg font-bold mb-3 text-gray-800">
            📥 Scarica Documento
          </h3>
          
          <button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    scaricaPDF();
  }}
  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-bold hover:from-purple-700 hover:to-purple-800 shadow-lg transition"
>
  ⬇️ SCARICA {documento.tipo.toUpperCase()}
</button>

          {/* Path file */}
          {/* Path file */}
<div className="bg-white rounded p-3">
  <p className="text-sm font-semibold text-gray-700 mb-2">
    📂 Path file (dopo download):
  </p>
  <div className="flex gap-2 items-start">
    <code className="flex-1 p-2 bg-gray-100 rounded text-xs break-all font-mono">
      {downloadPath}
    </code>
    <button
      onClick={() => copyToClipboard(downloadPath, 'Path file')}
      className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition flex-shrink-0"
    >
      📋
    </button>
  </div>
  
  {/* Link riconfigura */}
  <div className="mt-2 flex justify-between items-center gap-2">
    <p className="text-xs text-gray-500">
      💡 Usa questo path per caricare velocemente su YouSign
    </p>
    <button
      onClick={() => {
        const newUser = prompt(
          '⚙️ RICONFIGURA USERNAME\n\n' +
          'Inserisci il tuo nome utente Windows:\n' +
          '(lo trovi in C:\\Users\\[USERNAME])',
          username
        );
        if (newUser && newUser.trim()) {
          localStorage.setItem('fda_username', newUser.trim());
          setUsername(newUser.trim());
        }
      }}
      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
    >
      ⚙️ Cambia username
    </button>
  </div>
</div>
</div>
{/* Alert Normativa CE - SOLO per Manuale */}
{documento.tipo === 'Manuale CE' && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
    <div className="flex items-center gap-2">
      <span className="text-lg">💡</span>
      <p className="text-sm text-yellow-900">
        <strong>Ricorda:</strong> Su YouSign aggiungi una nota nel campo "Testo libero" 
        riguardo alla conferma "Letto e compreso"
      </p>
    </div>
  </div>
)}
        {/* Sezione YouSign */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold mb-3 text-gray-800">
            ✍️ Invia su YouSign
          </h3>
          
          <button
            onClick={apriYouSign}
            className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg font-bold hover:from-yellow-600 hover:to-yellow-700 shadow-lg transition mb-3"
          >
            🌐 APRI YOUSIGN
          </button>
        </div>

        {/* Dati Firmatario */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold mb-3 text-gray-800">
            📋 Dati Firmatario (da copiare su YouSign)
          </h3>
          
          <div className="space-y-2">
            {/* Rappresentante legale */}
            <div className="bg-white rounded p-3 flex justify-between items-center">
              <div className="flex-1">
                <span className="text-xs text-gray-500 block">👤 Rappresentante legale</span>
                <code className="text-sm font-semibold">{documento.firmatario}</code>
              </div>
              <button
                onClick={() => copyToClipboard(documento.firmatario, 'Rappresentante legale')}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition"
              >
                📋 Copia
              </button>
            </div>

            {/* Email */}
            <div className="bg-white rounded p-3 flex justify-between items-center">
              <div className="flex-1">
                <span className="text-xs text-gray-500 block">📧 Email</span>
                <code className="text-sm font-semibold">{documento.email}</code>
              </div>
              <button
                onClick={() => copyToClipboard(documento.email, 'Email')}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition"
              >
                📋 Copia
              </button>
            </div>

            {/* Cellulare */}
            <div className="bg-white rounded p-3 flex justify-between items-center">
              <div className="flex-1">
                <span className="text-xs text-gray-500 block">📱 Cellulare</span>
                <code className="text-sm font-semibold">{documento.cellulare || 'Non disponibile'}</code>
              </div>
              <button
                onClick={() => copyToClipboard(documento.cellulare, 'Cellulare')}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition"
                disabled={!documento.cellulare}
              >
                📋 Copia
              </button>
            </div>
          </div>
        </div>

        {/* Istruzioni */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-bold text-blue-900 mb-2">
            💡 Procedura veloce:
          </p>
          <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
            <li>Click "<strong>⬇️ Scarica</strong>" sopra</li>
            <li>Click "<strong>🌐 Apri YouSign</strong>"</li>
            <li>Su YouSign, click "<strong>Carica file</strong>"</li>
            <li>Nella finestra dialog:
              <ul className="ml-4 mt-1 list-disc">
                <li>Premi <kbd className="px-1 bg-white rounded">Ctrl+L</kbd> (vai a barra path)</li>
                <li>Premi <kbd className="px-1 bg-white rounded">Ctrl+V</kbd> (incolla path copiato)</li>
                <li>Premi <kbd className="px-1 bg-white rounded">Enter</kbd></li>
              </ul>
            </li>
            <li><strong>Incolla i dati</strong> del firmatario (usa bottoni "📋 Copia")</li>
            <li><strong>Configura firma</strong> e invia</li>
          </ol>
        </div>

        {/* Bottone chiusura */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
        >
          ✅ Documento Inviato su YouSign
        </button>
        
      </div>
    </div>
  );
};

export default DocumentoYouSignModal;