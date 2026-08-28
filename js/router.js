/**
 * router.js
 * ---------------------------------------------------------
 * Minimal hash-based router. No page reloads, no build step —
 * just maps '#/dashboard', '#/expenses', '#/groups/:id', etc.
 * to a render function, and keeps the sidebar/tabbar "active"
 * state and the topbar title in sync with whatever's showing.
 */

const ROUTE_TITLES = {
  dashboard: 'Dashboard',
  expenses: 'Expenses',
  groups: 'Groups',
  categories: 'Categories',
  profile: 'Profile',
};

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  return { route: parts[0] || 'dashboard', param: parts[1] || null };
}

async function handleRouteChange() {
  const { route, param } = parseHash();

  document.querySelectorAll('[data-route]').forEach(link => {
    link.classList.toggle('is-active', link.dataset.route === route);
  });

  const topbarTitle = document.getElementById('topbar-title');

  switch (route) {
    case 'dashboard':
      topbarTitle.textContent = 'Dashboard';
      renderDashboardView();
      break;
    case 'expenses':
      topbarTitle.textContent = 'Expenses';
      renderExpensesView();
      break;
    case 'groups':
      if (param) {
        const group = groupById(param);
        topbarTitle.textContent = group ? group.name : 'Group';
        await renderGroupDetailView(param);
      } else {
        topbarTitle.textContent = 'Groups';
        renderGroupsView();
      }
      break;
    case 'categories':
      topbarTitle.textContent = 'Categories';
      renderCategoriesView();
      break;
    case 'profile':
      topbarTitle.textContent = 'Profile';
      renderProfileView();
      break;
    default:
      window.location.hash = '#/dashboard';
  }

  renderIcons(viewRoot);
}

function startRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  if (!window.location.hash) window.location.hash = '#/dashboard';
  handleRouteChange();
}
