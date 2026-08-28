/**
 * config.js
 * ---------------------------------------------------------
 * Fill these two values in from your own Supabase project:
 * Supabase Dashboard → Project Settings → API.
 *
 *   SUPABASE_URL       → "Project URL"
 *   SUPABASE_ANON_KEY  → "anon public" key (NOT the service_role key —
 *                          that one must never be used in frontend code)
 */
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
