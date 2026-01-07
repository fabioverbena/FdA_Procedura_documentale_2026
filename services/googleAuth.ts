// services/googleAuth.ts
// Implementazione completa OAuth 2.0 per Google APIs

// ==========================================
// CONFIGURAZIONE
// ==========================================
const GOOGLE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '88007102270-j0f7dbsj6uv8qdnddblhv2fkat46k9d4.apps.googleusercontent.com',
  redirectUri: window.location.origin,
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ')
};

const TOKEN_KEY = 'google_oauth_token';
const TOKEN_EXPIRY_KEY = 'google_oauth_expiry';

// ==========================================
// GESTIONE TOKEN
// ==========================================
export const saveToken = (accessToken: string, expiresIn: number) => {
  const expiryTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  console.log('✅ Token salvato. Scade tra:', Math.round(expiresIn / 60), 'minuti');
};

export const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) {
    console.log('⚠️ Token non trovato');
    return null;
  }
  
  if (Date.now() >= parseInt(expiry)) {
    console.log('⚠️ Token scaduto');
    clearToken();
    return null;
  }
  
  return token;
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  console.log('🗑️ Token rimosso');
};

export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

// ==========================================
// OAUTH FLOW
// ==========================================
export const initiateGoogleLogin = () => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  
  authUrl.searchParams.set('client_id', GOOGLE_CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', GOOGLE_CONFIG.redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', GOOGLE_CONFIG.scopes);
  authUrl.searchParams.set('prompt', 'consent select_account');     // ← Forza consenso
  authUrl.searchParams.set('include_granted_scopes', 'true');      // ← Aggiunto
  // NON mettere access_type: offline con response_type: token!
  
  console.log('🔍 URL OAuth completo:', authUrl.toString());
  window.location.href = authUrl.toString();
};

export const handleOAuthCallback = (): boolean => {
  const hash = window.location.hash;
  
  if (!hash.includes('access_token')) {
    return false;
  }
  
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  
  if (!accessToken || !expiresIn) {
    console.error('❌ Token mancante nella risposta OAuth');
    return false;
  }
  
  saveToken(accessToken, parseInt(expiresIn));
  
  // Rimuove hash dall'URL
  window.history.replaceState(null, '', window.location.pathname);
  
  console.log('✅ Login completato con successo');
  return true;
};

export const logout = () => {
  clearToken();
  console.log('👋 Logout effettuato');
};

// ==========================================
// GMAIL API - INVIO EMAIL
// ==========================================
export const sendEmail = async (
  to: string,
  subject: string,
  body: string,
  attachments?: Array<{ filename: string; mimeType: string; data: string }>
): Promise<boolean> => {
  const token = getToken();
  
  if (!token) {
    console.error('❌ Token non disponibile per invio email');
    throw new Error('Non autenticato. Effettua il login prima di inviare email.');
  }

  try {
    let email: string;

    // Email aziendale per CC automatico
    const ccEmail = 'fiordacqua@gmail.com';

    if (attachments && attachments.length > 0) {
      // Email con allegati (multipart)
      const boundary = '----=_NextPart_' + Math.random().toString(36).substring(7);
      
      const emailParts = [
        `To: ${to}`,
        `Cc: ${ccEmail}`,  // ← CC AUTOMATICO AGGIUNTO!
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        '',
        body,
        ''
      ];

      // Aggiungi allegati
      attachments.forEach(att => {
        emailParts.push(`--${boundary}`);
        emailParts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
        emailParts.push('Content-Transfer-Encoding: base64');
        emailParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        emailParts.push('');
        emailParts.push(att.data);
        emailParts.push('');
      });

      emailParts.push(`--${boundary}--`);
      email = emailParts.join('\r\n');

      console.log('📧 Invio email con', attachments.length, 'allegato/i + CC a', ccEmail);
    } else {
      // Email semplice senza allegati
      email = [
        `To: ${to}`,
        `Cc: ${ccEmail}`,  // ← CC AUTOMATICO AGGIUNTO!
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        body
      ].join('\r\n');
      
      console.log('📧 Invio email semplice + CC a', ccEmail);
    }

    // Codifica in base64url
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('📧 Invio email a:', to);
    console.log('📧 Oggetto:', subject);

    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Errore Gmail API:', error);
      throw new Error(`Gmail API Error: ${error.error.message}`);
    }

    const result = await response.json();
    console.log('✅ Email inviata con successo. ID:', result.id);
    return true;

  } catch (error) {
    console.error('❌ Errore invio email:', error);
    throw error;
  }
};

// ==========================================
// UTILITY - INFO UTENTE
// ==========================================
export const getUserInfo = async (): Promise<{ email: string; name: string } | null> => {
  const token = getToken();
  
  if (!token) {
    console.warn('⚠️ Token non disponibile per recuperare info utente');
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Token scaduto o invalido');
        clearToken();
      }
      return null;
    }

    const data = await response.json();
    console.log('✅ Info utente recuperate:', data.email);
    
    return {
      email: data.email,
      name: data.name || data.email
    };
  } catch (error) {
    console.error('❌ Errore recupero info utente:', error);
    return null;
  }
};