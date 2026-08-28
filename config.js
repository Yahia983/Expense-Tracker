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
const SUPABASE_URL = 'https://anwaqabmonxaflzxtqmy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0pBSkHoSHZ8AjzzYLY3Pw_dFucvnph';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);