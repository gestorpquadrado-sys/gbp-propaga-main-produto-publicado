import { supabase } from '@/integrations/supabase/client';
import { appEnv } from '@/lib/env';

export async function verifyDirectorySubmissions(params: {
  syncId?: string;
  locationId?: string;
  limit?: number;
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const url = new URL(appEnv.directoryVerifyEndpoint);
  if (params.syncId) url.searchParams.set('sync_id', params.syncId);
  if (params.locationId) url.searchParams.set('location_id', params.locationId);
  if (params.limit) url.searchParams.set('limit', String(params.limit));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Falha na verificação: ${response.status} ${details}`);
  }

  return response.json();
}
