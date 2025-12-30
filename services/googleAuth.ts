// services/googleAuth.ts
// Implementazione completa OAuth 2.0 per Google APIs

// ==========================================
// CONFIGURAZIONE
// ==========================================
const GOOGLE_CONFIG = {
  clientId: '88007102270-j0f7dbsj6uv8qdnddblhv2fkat46k9d4.apps.googleusercontent.com',
  redirectUri: window.location.origin,
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/documents'
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
};

export const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) return null;
  
  if (Date.now() >= parseInt(expiry)) {
    clearToken();
    return null;
  }
  
  return token;
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
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
  authUrl.searchParams.set('prompt', 'consent');
  
  window.location.href = authUrl.toString();
};

export const handleOAuthCallback = (): boolean => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  
  if (accessToken && expiresIn) {
    saveToken(accessToken, parseInt(expiresIn));
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  
  return false;
};

export const logout = () => {
  clearToken();
  window.location.reload();
};

// ==========================================
// GMAIL API - Invio Email
// ==========================================
export const sendEmail = async (
  to: string,
  subject: string,
  body: string
): Promise<void> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Non autenticato. Effettua il login Google.');
  }
  
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ].join('\r\n');
  
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedEmail })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Errore Gmail API: ${error.error?.message || response.statusText}`);
  }
};