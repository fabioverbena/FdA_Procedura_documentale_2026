// api/_lib/auth.ts
// Verifica il Bearer token passato dall'orchestratore

export function checkBearer(authHeader: string | undefined): boolean {
  const secret = process.env.API_SECRET_TOKEN;
  if (!secret) {
    console.error('API_SECRET_TOKEN non configurato in .env');
    return false;
  }
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token === secret;
}
