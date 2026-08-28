/**
 * app.js
 * ---------------------------------------------------------
 * Entry point. Wires the auth screen, listens for Supabase
 * auth state changes, and boots the signed-in app (data load,
 * router, realtime) once a session exists.
 */

const authDom = {
  screen: document.getElementById('auth-screen'),
  tabSignin: document.getElementById('tab-signin'),
  tabSignup: document.getElementById('tab-signup'),
  signinForm: document.getElementById('signin-form'),
  signupForm: document.getElementById('signup-form'),
  signinError: document.getElementById('signin-error'),
  signupError: document.getElementById('signup-error'),
  signinSubmit: document.getElementById('signin-submit'),
  signupSubmit: document.getElementById('signup-submit'),
};

const appShellDom = {
  shell: document.getElementById('app-shell'),
};

function switchAuthTab(target) {
  const isSignin = target === 'signin';
  authDom.tabSignin.classList.toggle('is-active', isSignin);
  authDom.tabSignup.classList.toggle('is-active', !isSignin);
  authDom.tabSignin.setAttribute('aria-selected', String(isSignin));
  authDom.tabSignup.setAttribute('aria-selected', String(!isSignin));
  authDom.signinForm.hidden = !isSignin;
  authDom.signupForm.hidden = isSignin;
  authDom.signinError.textContent = '';
  authDom.signupError.textContent = '';
}

function bindAuthScreenEvents() {
  authDom.tabSignin.addEventListener('click', () => switchAuthTab('signin'));
  authDom.tabSignup.addEventListener('click', () => switchAuthTab('signup'));

  authDom.signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authDom.signinError.textContent = '';
    authDom.signinSubmit.disabled = true;
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const { error } = await signIn(email, password);
    authDom.signinSubmit.disabled = false;
    if (error) authDom.signinError.textContent = friendlyAuthError(error);
    // On success, onAuthChange picks up the new session and boots the app.
  });

  authDom.signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authDom.signupError.textContent = '';
    authDom.signupSubmit.disabled = true;
    const fullName = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!fullName) { authDom.signupError.textContent = 'Please enter your name.'; authDom.signupSubmit.disabled = false; return; }
    if (password.length < 8) { authDom.signupError.textContent = 'Password must be at least 8 characters.'; authDom.signupSubmit.disabled = false; return; }

    const { data, error } = await signUp(fullName, email, password);
    authDom.signupSubmit.disabled = false;
    if (error) { authDom.signupError.textContent = friendlyAuthError(error); return; }

    if (!data.session) {
      // Email confirmation is likely enabled on this Supabase project.
      document.getElementById('auth-note').textContent = 'Account created \u2014 check your email to confirm, then sign in.';
      switchAuthTab('signin');
    }
  });
}

let appBooted = false;

async function bootSignedInApp(user) {
  store.user = user;
  await loadAllData();

  document.getElementById('sidebar-name').textContent = store.profile?.full_name || user.email;
  document.getElementById('sidebar-email').textContent = user.email;
  const avatarEl = document.getElementById('sidebar-avatar');
  avatarEl.textContent = initials(store.profile?.full_name || user.email);
  avatarEl.style.background = store.profile?.avatar_color || '#6D5AE6';

  authDom.screen.hidden = true;
  appShellDom.shell.hidden = false;
  renderIcons(document);

  if (!appBooted) {
    startRouter();
    subscribeToRealtime(() => {
      document.getElementById('sync-pill').hidden = false;
      handleRouteChange();
    });
    appBooted = true;
  } else {
    handleRouteChange();
  }
}

function showAuthScreen() {
  appBooted = false;
  unsubscribeFromRealtime();
  appShellDom.shell.hidden = true;
  authDom.screen.hidden = false;
  authDom.signinForm.reset();
  authDom.signupForm.reset();
}

async function init() {
  renderIcons(document);
  bindAuthScreenEvents();
  bindModalEvents();

  document.getElementById('signout-btn').addEventListener('click', async () => {
    await signOut();
  });
  document.getElementById('quick-add-btn').addEventListener('click', () => openAddExpenseModal());
  document.getElementById('quick-add-fab').addEventListener('click', () => openAddExpenseModal());

  window.onDataChanged = async (skipReload = false) => {
    if (!skipReload) await loadAllData();
    handleRouteChange();
  };

  onAuthChange((user) => {
    if (user) bootSignedInApp(user);
    else showAuthScreen();
  });

  const existingUser = await getCurrentUser();
  if (existingUser) bootSignedInApp(existingUser);
}

document.addEventListener('DOMContentLoaded', init);
