/**
 * auth.js
 * ---------------------------------------------------------
 * All Supabase Auth calls live here. auth.onAuthStateChange is
 * the single source of truth for "are we logged in" — app.js
 * listens to it and switches between the auth screen and the
 * app shell, rather than app.js polling or guessing.
 */

async function signUp(fullName, email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user ?? null;
}

function onAuthChange(callback) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

/** Translates raw Supabase error messages into plain, user-facing text. */
function friendlyAuthError(error) {
  if (!error) return '';
  const msg = error.message || '';
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('User already registered')) return 'An account with that email already exists.';
  if (msg.includes('Password should be at least')) return 'Password must be at least 8 characters.';
  if (msg.includes('Unable to validate email')) return 'That doesn\u2019t look like a valid email address.';
  return msg || 'Something went wrong. Please try again.';
}
