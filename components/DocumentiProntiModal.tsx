import React from 'react';

interface DocumentiProntiModalProps {
  show: boolean;
  onClose: () => void;
  documenti: {
    manuale: { url: string; filename: string };
    garanzia: { url: string; filename: string };
    firmatario: string;
    email: string;
    cellulare: string;
    nomeCliente: string;
  } | null;
}

const DocumentiProntiModal: React.FC<DocumentiProntiModalProps> = ({ 
  show, 
  onClose, 
  documenti 
}) => {
  if (!show || !documenti) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log(`✅ ${label} copiato negli appunti`);
        alert(`✅ ${label} copiato!`);
      })
      .catch(err => {
        console.error('Errore copia:', err);
        alert('❌ Errore durante la copia');
      });
  };

  const apriDriveEYouSign = (driveUrl: string) => {
    window.open(driveUrl, '_blank');
    setTimeout(() => {
      window.open('https://yousign.app', '_blank');
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ✅ Documenti Pronti
          </h2>
          <p className="text-gray-600">
            Cliente: <strong>{documenti.nomeCliente}</strong>
          </p>
        </div>
        
        {/* Sezione Manuale */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold mb-3 text-blue-800 flex items-center gap-2">
            📘 Manuale CE
          </h3>
          
          <div className="space-y-3">
            {/* Nome file */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📄 File:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                  {documenti.manuale.filename}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.manuale.filename, 'Nome file Manuale')}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition"
              >
                📋 Copia nome file
              </button>
            </div>
            
            {/* Rappresentante legale */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  👤 Rappresentante legale:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.firmatario}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.firmatario, 'Rappresentante legale')}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition"
              >
                📋 Copia rappresentante legale
              </button>
            </div>
            
            {/* Email */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📧 Email:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.email}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.email, 'Email')}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition"
              >
                📋 Copia email
              </button>
            </div>

            {/* Cellulare */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📱 Cellulare:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.cellulare || 'Non disponibile'}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.cellulare, 'Cellulare')}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition"
              >
                📋 Copia cellulare
              </button>
            </div>
          </div>
          
          {/* Bottone principale Manuale */}
          <button
            onClick={() => apriDriveEYouSign(documenti.manuale.url)}
            className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 shadow-lg transition transform hover:scale-[1.02]"
          >
            🚀 Apri Drive + YouSign (Manuale)
          </button>
        </div>
        
        {/* Sezione Garanzia */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold mb-3 text-green-800 flex items-center gap-2">
            📜 Garanzia CE
          </h3>
          
          <div className="space-y-3">
            {/* Nome file */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📄 File:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                  {documenti.garanzia.filename}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.garanzia.filename, 'Nome file Garanzia')}
                className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition"
              >
                📋 Copia nome file
              </button>
            </div>
            
            {/* Rappresentante legale */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  👤 Rappresentante legale:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.firmatario}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.firmatario, 'Rappresentante legale')}
                className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition"
              >
                📋 Copia rappresentante legale
              </button>
            </div>
            
            {/* Email */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📧 Email:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.email}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.email, 'Email')}
                className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition"
              >
                📋 Copia email
              </button>
            </div>

            {/* Cellulare */}
            <div className="bg-white rounded p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 min-w-[80px]">
                  📱 Cellulare:
                </span>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {documenti.cellulare || 'Non disponibile'}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(documenti.cellulare, 'Cellulare')}
                className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition"
              >
                📋 Copia cellulare
              </button>
            </div>
          </div>
          
          {/* Bottone principale Garanzia */}
          <button
            onClick={() => apriDriveEYouSign(documenti.garanzia.url)}
            className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 shadow-lg transition transform hover:scale-[1.02]"
          >
            🚀 Apri Drive + YouSign (Garanzia)
          </button>
        </div>
        
        {/* Box istruzioni */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-900">
            <strong>💡 Procedura rapida:</strong>
          </p>
          <ol className="text-sm text-yellow-800 mt-2 space-y-1 ml-4 list-decimal">
            <li>Click "🚀 Apri Drive + YouSign"</li>
            <li><strong>Scarica</strong> il PDF da Drive sul tuo computer</li>
            <li>Su YouSign, <strong>carica</strong> il PDF scaricato (drag & drop o seleziona file)</li>
            <li><strong>Incolla</strong> Rappresentante legale (già copiato!)</li>
            <li><strong>Incolla</strong> Email (già copiata!)</li>
            <li><strong>Incolla</strong> Cellulare (già copiato!)</li>
            <li>Configura campi firma e invia</li>
            <li>Ripeti per secondo documento</li>
          </ol>
          <p className="text-sm text-yellow-800 mt-3">
            ⚠️ <strong>Nota:</strong> Non puoi trascinare direttamente da Drive a YouSign. 
            Devi prima scaricare il PDF, poi caricarlo su YouSign.
          </p>
        </div>
        
        {/* Bottone chiusura */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-300 text-gray-800 rounded-lg font-bold hover:bg-gray-400 transition"
        >
          ✅ Procedura completata
        </button>
        
      </div>
    </div>
  );
};

export default DocumentiProntiModal;