export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface CompanyRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  category: string | null;
  description: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleLocationRow {
  id: string;
  company_id: string;
  user_id: string;
  google_location_id: string;
  google_place_id: string | null;
  google_maps_uri: string | null;
  name: string;
  description: string | null;
  phone_primary: string | null;
  phone_additional: string | null;
  website: string | null;
  address_full: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  address_neighborhood: string | null;
  category_primary: string | null;
  categories_additional: string[] | null;
  hours: Json;
  raw_payload: Json;
  created_at: string;
  updated_at: string;
}

export interface DirectoryPageRow {
  id: string;
  company_id: string;
  location_id: string | null;
  user_id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  public_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectorySubmissionRow {
  id: string;
  company_id: string;
  location_id: string | null;
  user_id: string;
  channel_code: string;
  status: string;
  message: string | null;
  status_code: number | null;
  duration_ms: number | null;
  raw_response: Json;
  sync_id?: string | null;
  submission_type?: string | null;
  directory_name?: string | null;
  form_url?: string | null;
  profile_url?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  verification_status?: string | null;
  verification_message?: string | null;
  next_verification_at?: string | null;
  created_at: string;
  updated_at: string;
}
