import { supabase } from '@/integrations/supabase/client';
import { appEnv } from '@/lib/env';
import type { BusinessProfile, SyncResponse } from '@/types/business-profile';

export class SyncError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'SyncError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function syncBusinessProfile(payload: BusinessProfile): Promise<SyncResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(appEnv.syncWebhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => null);
    throw new SyncError(
      `Falha na sincronização: ${response.statusText}`,
      response.status,
      details
    );
  }

  return response.json() as Promise<SyncResponse>;
}
