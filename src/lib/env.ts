const env = import.meta.env;

export const appEnv = {
  supabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined,
  gbpImportEndpoint: (env.VITE_GBP_IMPORT_ENDPOINT || 'https://webhook.pquadrado.com.br/webhook/p2/gbp/import') as string,
  syncWebhookEndpoint: (env.VITE_SYNC_WEBHOOK_ENDPOINT || 'https://webhook.pquadrado.com.br/webhook/p2/business-profile/sync') as string,
  gbpCategoriesEndpoint: (env.VITE_GBP_CATEGORIES_ENDPOINT || 'https://webhook.pquadrado.com.br/webhook/p2/google-categories/list') as string,
  directoryVerifyEndpoint: (env.VITE_DIRECTORY_VERIFY_ENDPOINT || 'https://webhook.pquadrado.com.br/webhook/p2/directory-submissions/verify') as string,
  publicBaseUrl: (env.VITE_PUBLIC_BASE_URL || window.location.origin) as string,
};

export function requireEnv(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${label}`);
  }
  return value;
}
