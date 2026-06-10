export interface BusinessProfile {
  name: string;
  phone_primary: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  channels: string[];

  // Identificadores internos usados pelo painel novo/Supabase.
  company_id?: string;
  location_id?: string;
  user_id?: string;

  // Identificadores externos usados por integrações.
  external_id?: string;
  google_location_id?: string;
  google_place_id?: string;
  facebook_page_id?: string;

  phone_whatsapp?: string;
  website?: string;
  email?: string;
  description?: string;
  business_hours?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  categories?: string[];
}

export type ChannelStatus =
  | 'pending'
  | 'syncing'
  | 'success'
  | 'sent'
  | 'submitted'
  | 'manual_required'
  | 'pending_review'
  | 'found_online'
  | 'not_found'
  | 'data_mismatch'
  | 'manual_check_required'
  | 'captcha_required'
  | 'inactive'
  | 'not_implemented'
  | 'not_returned'
  | 'error';

export type VerificationStatus =
  | 'not_checked'
  | 'pending_review'
  | 'found_online'
  | 'not_found'
  | 'data_mismatch'
  | 'manual_check_required'
  | 'error';

export interface ChannelResult {
  status: ChannelStatus;
  message?: string;
  statusCode?: number;
  durationMs?: number;
  submissionType?: string | null;
  directoryName?: string | null;
  formUrl?: string | null;
  websiteUrl?: string | null;
  profileUrl?: string | null;
  searchUrl?: string | null;
  checkedUrl?: string | null;
  verificationStatus?: VerificationStatus | string | null;
  verificationMessage?: string | null;
  nextVerificationAt?: string | null;
  manualInstructions?: string | null;
  copyPayload?: Record<string, string> | null;
}

export interface SyncResponse {
  success: boolean;
  sync_id: string;
  timestamp: string;
  total_channels?: number;
  success_count?: number;
  manual_count?: number;
  error_count?: number;
  ignored_provider_channels?: string[];
  results: Record<string, ChannelResult>;
}

export type DirectorySubmissionType = 'api' | 'email' | 'form' | 'manual' | 'partner' | 'reference';

export interface DirectoryChannel {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  requires_approval: boolean;
  categories: string[];

  // Metadados de diretório/integração. Podem vir nulos em bancos antigos.
  country?: string | null;
  region?: string | null;
  segment?: string | null;
  submission_type?: DirectorySubmissionType | string | null;
  email_to?: string | null;
  website_url?: string | null;
  api_available?: boolean | null;
  api_type?: string | null;
  requires_login?: boolean | null;
  requires_manual_review?: boolean | null;
  requires_paid_plan?: boolean | null;
  priority?: number | null;
  last_checked_at?: string | null;
  last_check_status?: 'active' | 'inactive' | 'warning' | 'unknown' | string | null;
  last_check_http_status?: number | null;
  last_check_message?: string | null;
  notes?: string | null;
}


export type BusinessType =
  | 'general'
  | 'restaurants'
  | 'healthcare'
  | 'real_estate'
  | 'services'
  | 'hotels';
