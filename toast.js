/**
 * toast.js
 * ---------------------------------------------------------
 * Lightweight, dependency-free toast notifications.
 */
function showToast(message, variant = 'default') {
  const stack = document.getElementById('toast-stack');
  const toast = document.createElement('div');
  toast.className = `toast${variant !== 'default' ? ` toast--${variant}` : ''}`;
  toast.textContent = message; // always textContent: message may echo back user input (e.g. an email)
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
