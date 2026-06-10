import { supabase } from '@/integrations/supabase/client';
import { uniqueSlug } from '@/lib/slug';
import type { BusinessProfile, ChannelResult, SyncResponse } from '@/types/business-profile';
import type { GoogleLocation } from '@/components/GoogleImportModal';
import type { CompanyRow, GoogleLocationRow } from '@/types/database';

function firstCategory(categories?: string[]): string | null {
  return categories?.filter(Boolean)[0] || null;
}

function makeAddress(profile: BusinessProfile): string {
  return [profile.address_street, profile.address_number].filter(Boolean).join(', ');
}

function normalizeGoogleLocationId(value?: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('locations/')) return raw;
  if (raw.startsWith('accounts/')) {
    const match = raw.match(/locations\/[^/]+$/);
    return match ? match[0] : raw;
  }
  if (/^\d+$/.test(raw)) return `locations/${raw}`;
  return raw;
}

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Usuário não autenticado');
  return data.user.id;
}

export async function upsertCompanyFromProfile(profile: BusinessProfile): Promise<CompanyRow> {
  const userId = await getCurrentUserId();
  const slug = uniqueSlug(profile.name, profile.address_city || profile.external_id);

  const payload = {
    user_id: userId,
    name: profile.name,
    slug,
    phone: profile.phone_primary || null,
    whatsapp: profile.phone_whatsapp || null,
    email: profile.email || null,
    website: profile.website || null,
    category: firstCategory(profile.categories),
    description: profile.description || null,
    address: profile.address_street || null,
    address_number: profile.address_number || null,
    address_complement: profile.address_complement || null,
    neighborhood: profile.address_neighborhood || null,
    city: profile.address_city || null,
    state: profile.address_state || null,
    postal_code: profile.address_zip || null,
    country: 'BR',
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CompanyRow;
  }

  const { data, error } = await supabase
    .from('companies')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyRow;
}

export async function upsertGoogleLocationFromProfile(profile: BusinessProfile, companyId: string): Promise<GoogleLocationRow> {
  const userId = await getCurrentUserId();
  const googleLocationId =
    normalizeGoogleLocationId(profile.google_location_id) ||
    normalizeGoogleLocationId(profile.external_id) ||
    `manual:${companyId}`;

  const payload = {
    company_id: companyId,
    user_id: userId,
    google_location_id: googleLocationId,
    name: profile.name,
    description: profile.description || null,
    phone_primary: profile.phone_primary || null,
    phone_additional: null,
    website: profile.website || null,
    address_full: makeAddress(profile) || null,
    address_city: profile.address_city || null,
    address_state: profile.address_state || null,
    address_postal_code: profile.address_zip || null,
    address_country: 'BR',
    address_neighborhood: profile.address_neighborhood || null,
    category_primary: firstCategory(profile.categories),
    categories_additional: profile.categories || [],
    hours: profile.business_hours ? JSON.parse(profile.business_hours) : {},
    raw_payload: profile,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('google_locations')
    .upsert(payload, { onConflict: 'user_id,google_location_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as GoogleLocationRow;
}

export async function saveImportedLocations(locations: GoogleLocation[]): Promise<GoogleLocation[]> {
  const userId = await getCurrentUserId();
  const savedLocations: GoogleLocation[] = [];

  for (const location of locations) {
    const companySlug = uniqueSlug(location.name, location.address_city || location.google_location_id);
    const companyPayload = {
      user_id: userId,
      name: location.name,
      slug: companySlug,
      phone: location.phone_primary || null,
      whatsapp: location.phone_primary || null,
      website: location.website || null,
      category: location.category_primary || null,
      description: location.description || null,
      address: location.address_full || null,
      neighborhood: location.address_neighborhood || null,
      city: location.address_city || null,
      state: location.address_state || null,
      postal_code: location.address_postal_code || null,
      country: location.address_country || 'BR',
      updated_at: new Date().toISOString(),
    };

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert(companyPayload, { onConflict: 'user_id,slug' })
      .select('id')
      .single();
    if (companyError) throw companyError;

    const { data: savedLocation, error: locationError } = await supabase
      .from('google_locations')
      .upsert({
        company_id: company.id,
        user_id: userId,
        google_location_id: normalizeGoogleLocationId(location.google_location_id) || location.google_location_id,
        google_place_id: location.google_place_id || null,
        google_maps_uri: location.google_maps_uri || null,
        name: location.name,
        description: location.description || null,
        phone_primary: location.phone_primary || null,
        phone_additional: location.phone_additional || null,
        website: location.website || null,
        address_full: location.address_full || null,
        address_city: location.address_city || null,
        address_state: location.address_state || null,
        address_postal_code: location.address_postal_code || null,
        address_country: location.address_country || 'BR',
        address_neighborhood: location.address_neighborhood || null,
        category_primary: location.category_primary || null,
        categories_additional: location.categories_additional || [],
        hours: location.hours || {},
        raw_payload: location,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_location_id' })
      .select('*')
      .single();
    if (locationError) throw locationError;

    savedLocations.push({
      ...location,
      id: savedLocation.id,
      company_id: company.id,
      user_id: userId,
      google_location_id: savedLocation.google_location_id,
    });
  }

  return savedLocations;
}

export async function listUserLocations(): Promise<GoogleLocation[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('google_locations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row: GoogleLocationRow) => ({
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id,
    google_location_id: row.google_location_id,
    google_place_id: row.google_place_id || '',
    google_maps_uri: row.google_maps_uri || '',
    name: row.name,
    description: row.description || '',
    phone_primary: row.phone_primary || '',
    phone_additional: row.phone_additional || '',
    website: row.website || '',
    address_full: row.address_full || '',
    address_city: row.address_city || '',
    address_state: row.address_state || '',
    address_postal_code: row.address_postal_code || '',
    address_country: row.address_country || 'BR',
    address_neighborhood: row.address_neighborhood || '',
    category_primary: row.category_primary || '',
    categories_additional: row.categories_additional || [],
    hours: (row.hours || {}) as GoogleLocation['hours'],
  }));
}

export async function saveSyncResults(profile: BusinessProfile, response: SyncResponse): Promise<void> {
  const company = await upsertCompanyFromProfile(profile);
  const location = await upsertGoogleLocationFromProfile(profile, company.id);
  const userId = await getCurrentUserId();

  const submissions = Object.entries(response.results).map(([channel, result]: [string, ChannelResult]) => ({
    company_id: company.id,
    location_id: location.id,
    user_id: userId,
    channel_code: channel,
    status: result.status,
    message: result.message || null,
    status_code: result.statusCode || null,
    duration_ms: result.durationMs || null,
    raw_response: result,
    sync_id: response.sync_id,
    submission_type: result.submissionType || null,
    directory_name: result.directoryName || channel,
    form_url: result.formUrl || null,
    profile_url: result.profileUrl || null,
    verification_status: result.verificationStatus || 'not_checked',
    verification_message: result.verificationMessage || null,
    next_verification_at: result.nextVerificationAt || null,
    submitted_at: ['sent', 'submitted', 'manual_required'].includes(result.status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }));

  if (submissions.length > 0) {
    const { error } = await supabase
      .from('directory_submissions')
      .upsert(submissions, { onConflict: 'user_id,location_id,channel_code' });
    if (error) throw error;
  }

  const { error: pageError } = await supabase
    .from('directory_pages')
    .upsert({
      company_id: company.id,
      location_id: location.id,
      user_id: userId,
      slug: company.slug,
      title: company.name,
      status: 'published',
      public_path: `/empresa/${company.slug}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,slug' });
  if (pageError) throw pageError;
}

function getDomainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0] || null;
  }
}

function fillTemplate(template: string, values: Record<string, string | null | undefined>): string {
  let output = template;
  const replacements: Record<string, string> = {
    '{name}': values.name || '',
    '{{business_name}}': values.name || '',
    '{city}': values.city || '',
    '{{city}}': values.city || '',
    '{state}': values.state || '',
    '{{state}}': values.state || '',
    '{phone}': values.phone || '',
    '{{phone}}': values.phone || '',
    '{zip}': values.zip || '',
    '{{zip}}': values.zip || '',
  };

  Object.entries(replacements).forEach(([key, value]) => {
    output = output.split(key).join(encodeURIComponent(value));
  });

  return output;
}

function buildAssistedSearchUrl(params: {
  template?: string | null;
  websiteUrl?: string | null;
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  zip?: string | null;
}): string | null {
  const values = {
    name: params.businessName || '',
    city: params.city || '',
    state: params.state || '',
    phone: params.phone || '',
    zip: params.zip || '',
  };

  if (params.template) {
    return fillTemplate(params.template, values);
  }

  const domain = getDomainFromUrl(params.websiteUrl);
  if (!domain) return null;

  const query = ['site:' + domain, params.businessName, params.city].filter(Boolean).join(' ');
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

export async function getDirectoryStatusByGoogleLocationId(googleLocationId: string) {
  const userId = await getCurrentUserId();
  const { data: location, error: locationError } = await supabase
    .from('google_locations')
    .select('id,name,phone_primary,address_city,address_state,address_postal_code')
    .eq('user_id', userId)
    .eq('google_location_id', googleLocationId)
    .maybeSingle();
  if (locationError) throw locationError;
  if (!location) return null;

  const { data, error } = await supabase
    .from('directory_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('location_id', location.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const channelCodes = Array.from(new Set((data || []).map((row: any) => row.channel_code).filter(Boolean)));
  const { data: channels, error: channelsError } = channelCodes.length
    ? await supabase
        .from('directory_channels')
        .select('code,name,submission_type,form_url,website_url,search_url_template,verification_url_template,last_check_status,requires_login,requires_manual_review,api_available')
        .in('code', channelCodes)
    : { data: [], error: null } as any;
  if (channelsError) throw channelsError;

  const channelMap = new Map((channels || []).map((channel: any) => [channel.code, channel]));

  const results = Object.fromEntries((data || []).map((row: any) => {
    const channel = channelMap.get(row.channel_code) as any;
    const raw = row.raw_response || {};
    const searchUrl = raw.searchUrl || raw.checkedUrl || buildAssistedSearchUrl({
      template: channel?.search_url_template || channel?.verification_url_template,
      websiteUrl: channel?.website_url || raw.websiteUrl,
      businessName: location.name,
      city: location.address_city,
      state: location.address_state,
      phone: location.phone_primary,
      zip: location.address_postal_code,
    });

    return [
      row.channel_code,
      {
        status: row.status,
        message: row.message || undefined,
        statusCode: row.status_code || undefined,
        durationMs: row.duration_ms || undefined,
        submissionType: row.submission_type || raw.submissionType || channel?.submission_type || undefined,
        directoryName: row.directory_name || raw.directoryName || channel?.name || undefined,
        formUrl: row.form_url || raw.formUrl || channel?.form_url || undefined,
        websiteUrl: raw.websiteUrl || channel?.website_url || undefined,
        profileUrl: row.profile_url || raw.profileUrl || undefined,
        searchUrl: searchUrl || undefined,
        checkedUrl: raw.checkedUrl || undefined,
        verificationStatus: row.verification_status || raw.verificationStatus || undefined,
        verificationMessage: row.verification_message || raw.verificationMessage || undefined,
        nextVerificationAt: row.next_verification_at || raw.nextVerificationAt || undefined,
        manualInstructions: raw.manualInstructions || undefined,
        copyPayload: raw.copyPayload || undefined,
      },
    ];
  }));

  return {
    locationName: location.name as string,
    updatedAt: (data?.[0]?.updated_at || new Date().toISOString()) as string,
    results,
  };
}

export async function saveDirectorySubmissionProfileUrl(
  googleLocationId: string,
  channelCode: string,
  profileUrl: string,
): Promise<void> {
  const userId = await getCurrentUserId();
  const cleanUrl = profileUrl.trim();

  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('Informe uma URL válida começando com http:// ou https://');
  }

  const { data: location, error: locationError } = await supabase
    .from('google_locations')
    .select('id')
    .eq('user_id', userId)
    .eq('google_location_id', googleLocationId)
    .maybeSingle();
  if (locationError) throw locationError;
  if (!location) throw new Error('Localização não encontrada');

  const { error } = await supabase
    .from('directory_submissions')
    .update({
      profile_url: cleanUrl,
      verification_status: 'found_online',
      verification_message: 'URL do perfil salva manualmente por conferência assistida.',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('location_id', location.id)
    .eq('channel_code', channelCode);

  if (error) throw error;
}
