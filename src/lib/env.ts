const env = import.meta.env;

// Base das Edge Functions. Os fallbacks apontavam para webhook.pquadrado.com.br — a VPS
// que foi escalada para zero em 20/10/2026. Com a variável faltando na Vercel, o app
// falava com um host morto e o erro aparecia como "não respondeu", nunca como
// "configuração ausente". Agora o fallback é o próprio projeto do Supabase.
const FUNCOES = 'https://fljcywbqzzakwgzyguvl.supabase.co/functions/v1';

export const appEnv = {
  supabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined,
  gbpImportEndpoint: (env.VITE_GBP_IMPORT_ENDPOINT || `${FUNCOES}/gbp-import`) as string,
  syncWebhookEndpoint: (env.VITE_SYNC_WEBHOOK_ENDPOINT || `${FUNCOES}/directory-propagate`) as string,
  gbpCategoriesEndpoint: (env.VITE_GBP_CATEGORIES_ENDPOINT || `${FUNCOES}/google-categories-list`) as string,
  directoryVerifyEndpoint: (env.VITE_DIRECTORY_VERIFY_ENDPOINT || `${FUNCOES}/directory-submissions-verify`) as string,
  equipeEndpoint: (env.VITE_EQUIPE_ENDPOINT || `${FUNCOES}/equipe`) as string,
  publicBaseUrl: (env.VITE_PUBLIC_BASE_URL || window.location.origin) as string,
};

export function requireEnv(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${label}`);
  }
  return value;
}
