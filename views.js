/**
 * views.js
 * ---------------------------------------------------------
 * One render function per screen. Every function reads from
 * `store` (data.js) and writes DOM into #view-root. User-supplied
 * text (titles, notes, names, emails) is always inserted via
 * textContent or dedicated setters — never interpolated into
 * innerHTML strings — so it can never be interpreted as markup.
 */

const viewRoot = document.getElementById('view-root');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------
function renderDashboardView() {
  viewRoot.innerHTML = '';
  const all = store.expenses;
  const stats = calculateStatistics(all);
  const breakdown = categoryBreakdown(all).slice(0, 6);

  const statGrid = el('div', 'stat-grid');
  statGrid.append(
    statCard('Total spent', formatCurrency(stats.total), true),
    statCard('Entries', String(stats.count)),
    statCard('Largest entry', stats.highest ? formatCurrency(stats.highest.amount) : '\u2014'),
    statCard('Categories used', String(breakdown.length))
  );
  viewRoot.appendChild(statGrid);

  const grid = el('div', 'dash-grid');

  const breakdownPanel = el('div', 'panel');
  const bHead = el('div', 'panel__head');
  bHead.appendChild(el('h2', null, 'Spending by category'));
  breakdownPanel.appendChild(bHead);
  breakdownPanel.appendChild(buildDonut(breakdown, stats.total));
  grid.appendChild(breakdownPanel);

  const recentPanel = el('div', 'panel');
  const rHead = el('div', 'panel__head');
  rHead.appendChild(el('h2', null, 'Recent activity'));
  recentPanel.appendChild(rHead);
  const recent = all.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  if (recent.length === 0) {
    recentPanel.appendChild(buildEmptyState('No expenses yet.', 'Add your first entry to see it here.'));
  } else {
    recent.forEach(exp => recentPanel.appendChild(buildExpenseRow(exp, { compact: true })));
  }
  grid.appendChild(recentPanel);

  viewRoot.appendChild(grid);
}

function statCard(label, value, accent) {
  const card = el('div', `stat-card${accent ? ' stat-card--accent' : ''}`);
  card.appendChild(el('div', 'stat-card__label', label));
  card.appendChild(el('div', 'stat-card__value', value));
  return card;
}

function buildDonut(breakdown, total) {
  const wrap = el('div', 'donut-wrap');
  const size = 140, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.width = '140px';
  svg.style.height = '140px';
  svg.style.flexShrink = '0';

  const bg = document.createElementNS(svg.namespaceURI, 'circle');
  bg.setAttribute('cx', size / 2); bg.setAttribute('cy', size / 2); bg.setAttribute('r', r);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#EEF0F8'); bg.setAttribute('stroke-width', stroke);
  svg.appendChild(bg);

  let offset = 0;
  breakdown.forEach(entry => {
    const fraction = total > 0 ? entry.amount / total : 0;
    const dash = fraction * c;
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', size / 2); circle.setAttribute('cy', size / 2); circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', entry.category.color);
    circle.setAttribute('stroke-width', stroke);
    circle.setAttribute('stroke-dasharray', `${dash} ${c - dash}`);
    circle.setAttribute('stroke-dashoffset', -offset);
    circle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    svg.appendChild(circle);
    offset += dash;
  });

  wrap.appendChild(svg);

  const legend = el('div', 'donut-legend');
  if (breakdown.length === 0) {
    legend.appendChild(el('p', null, 'No spending recorded yet.'));
  } else {
    breakdown.forEach(entry => {
      const item = el('div', 'donut-legend__item');
      const dot = el('span', 'legend-dot'); dot.style.background = entry.category.color;
      item.append(dot, el('span', 'donut-legend__name', entry.category.name), el('span', 'donut-legend__value', formatCurrency(entry.amount)));
      legend.appendChild(item);
    });
  }
  wrap.appendChild(legend);
  return wrap;
}

// ---------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------
function renderExpensesView() {
  viewRoot.innerHTML = '';

  const toolbar = el('div', 'toolbar');

  const searchField = el('div', 'field toolbar__search');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search title or notes\u2026';
  searchInput.value = store.view.search;
  searchInput.addEventListener('input', () => { store.view.search = searchInput.value; renderExpensesView(); });
  searchField.appendChild(searchInput);

  const catSelect = buildSelect(
    [['All', 'All categories'], ...store.categories.map(c => [c.id, c.name])],
    store.view.category,
    (val) => { store.view.category = val; renderExpensesView(); }
  );
  const groupSelect = buildSelect(
    [['All', 'All expenses'], ['Personal', 'Personal only'], ...store.groups.map(g => [g.id, g.name])],
    store.view.group,
    (val) => { store.view.group = val; renderExpensesView(); }
  );
  const sortSelect = buildSelect(
    [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['highest', 'Highest amount'], ['lowest', 'Lowest amount'], ['alpha', 'Alphabetical']],
    store.view.sort,
    (val) => { store.view.sort = val; renderExpensesView(); }
  );

  toolbar.append(searchField, catSelect, groupSelect, sortSelect);
  viewRoot.appendChild(toolbar);

  const list = getVisibleExpenses();
  const panel = el('div', 'panel');
  if (store.expenses.length === 0) {
    panel.appendChild(buildEmptyState('No expenses yet.', 'Add your first entry to start tracking your spending.'));
  } else if (list.length === 0) {
    panel.appendChild(buildEmptyState('No matching entries.', 'Try a different search term or clear your filters.'));
  } else {
    list.forEach(exp => panel.appendChild(buildExpenseRow(exp)));
  }
  viewRoot.appendChild(panel);
}

function buildSelect(options, selectedValue, onChange) {
  const wrap = el('div', 'field');
  const select = document.createElement('select');
  options.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === selectedValue) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(select);
  return wrap;
}

function buildExpenseRow(expense, opts = {}) {
  const row = el('li', 'expense-row');
  row.style.listStyle = 'none';

  const category = categoryById(expense.category_id);
  const dot = el('div', 'expense-row__dot', category ? initials(category.name) : '?');
  dot.style.background = category ? category.color : '#999';

  const main = el('div', 'expense-row__main');
  main.appendChild(el('p', 'expense-row__title', expense.title));
  const meta = el('div', 'expense-row__meta');
  meta.appendChild(el('span', null, category ? category.name : 'Uncategorized'));
  meta.appendChild(el('span', null, '\u00b7'));
  meta.appendChild(el('span', null, formatDate(expense.date)));
  if (expense.group_id) {
    const group = groupById(expense.group_id);
    if (group) {
      const chip = el('span', 'group-chip', group.name);
      chip.style.background = `${group.color}22`;
      chip.style.color = group.color;
      meta.appendChild(chip);
    }
  }
  main.appendChild(meta);
  if (expense.notes && !opts.compact) {
    const notes = el('p', 'expense-row__meta', expense.notes);
    notes.style.fontStyle = 'italic';
    notes.style.marginTop = '0.15rem';
    main.appendChild(notes);
  }

  const amount = el('span', 'expense-row__amount', formatCurrency(expense.amount));

  row.append(dot, main, amount);

  const isOwn = expense.user_id === store.user.id;
  if (isOwn && !opts.compact) {
    const actions = el('div', 'expense-row__actions');
    const editBtn = iconButton('edit', 'Edit expense', () => openEditExpenseModal(expense));
    actions.appendChild(editBtn);
    row.appendChild(actions);
  }

  return row;
}

function iconButton(iconName, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn--icon';
  btn.setAttribute('aria-label', label);
  const iconSpan = el('span', 'nav-link__icon');
  iconSpan.innerHTML = ICONS[iconName]; // static, developer-authored icon markup only
  btn.appendChild(iconSpan);
  btn.addEventListener('click', onClick);
  return btn;
}

function buildEmptyState(title, body) {
  const wrap = el('div', 'empty-state');
  wrap.appendChild(el('p', 'empty-state__title', title));
  wrap.appendChild(el('p', 'empty-state__body', body));
  return wrap;
}

// ---------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------
function renderCategoriesView() {
  viewRoot.innerHTML = '';
  const grid = el('div', 'card-grid');

  store.categories.forEach(cat => {
    const card = el('div', 'category-card');
    const dot = el('div', 'category-card__dot');
    dot.style.background = cat.color;
    card.appendChild(dot);
    card.appendChild(el('div', 'category-card__name', cat.name));
    if (cat.user_id === null) {
      card.appendChild(el('span', 'category-card__default', 'Default'));
    } else if (cat.user_id === store.user.id) {
      card.appendChild(iconButton('trash', `Delete ${cat.name}`, () => confirmDeleteCategory(cat)));
    }
    grid.appendChild(card);
  });

  const addTile = el('button', 'add-tile');
  addTile.type = 'button';
  const addIcon = el('span', 'add-tile__icon'); addIcon.innerHTML = ICONS.plus;
  addTile.append(addIcon, el('span', null, 'New category'));
  addTile.addEventListener('click', openAddCategoryModal);
  grid.appendChild(addTile);

  viewRoot.appendChild(grid);
}

function confirmDeleteCategory(cat) {
  openConfirmDialog({
    title: 'Delete this category?',
    body: `Expenses already using "${cat.name}" will keep their record but show as uncategorized.`,
    onConfirm: async () => {
      const result = await deleteCategory(cat.id);
      if (result.success) { showToast('Category deleted.'); window.onDataChanged?.(); }
      else showToast('Could not delete this category.', 'danger');
    }
  });
}

// ---------------------------------------------------------
// GROUPS (list)
// ---------------------------------------------------------
function renderGroupsView() {
  viewRoot.innerHTML = '';
  const grid = el('div', 'card-grid');

  store.groups.forEach(group => {
    const card = el('div', 'group-card');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${group.name}`);
    const goToGroup = () => { window.location.hash = `#/groups/${group.id}`; };
    card.addEventListener('click', goToGroup);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToGroup(); }
    });

    const top = el('div', 'group-card__top');
    const icon = el('div', 'group-card__icon', initials(group.name));
    icon.style.background = group.color;
    const info = document.createElement('div');
    info.appendChild(el('div', 'group-card__name', group.name));
    info.appendChild(el('div', 'group-card__meta', `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`));
    top.append(icon, info);
    card.appendChild(top);

    const groupTotal = store.expenses.filter(e => e.group_id === group.id).reduce((s, e) => s + Number(e.amount), 0);
    const totalLabel = el('span', 'group-card__total-label', 'Total spent');
    const totalWrap = el('div', 'group-card__total');
    totalWrap.append(totalLabel, document.createTextNode(formatCurrency(groupTotal)));
    card.appendChild(totalWrap);

    grid.appendChild(card);
  });

  const addTile = el('button', 'add-tile');
  addTile.type = 'button';
  const addIcon = el('span', 'add-tile__icon'); addIcon.innerHTML = ICONS.plus;
  addTile.append(addIcon, el('span', null, 'Create group'));
  addTile.addEventListener('click', openCreateGroupModal);
  grid.appendChild(addTile);

  viewRoot.appendChild(grid);
}

// ---------------------------------------------------------
// GROUP DETAIL
// ---------------------------------------------------------
async function renderGroupDetailView(groupId) {
  viewRoot.innerHTML = '';
  const group = groupById(groupId);
  if (!group) {
    viewRoot.appendChild(buildEmptyState('Group not found.', 'It may have been deleted, or you\u2019re no longer a member.'));
    return;
  }

  const head = el('div', 'group-detail__head');
  const back = el('a', 'back-link');
  back.href = '#/groups';
  const backIcon = el('span', 'nav-link__icon'); backIcon.innerHTML = ICONS.arrowLeft;
  back.append(backIcon, document.createTextNode('All groups'));
  head.appendChild(back);
  viewRoot.appendChild(head);

  const topRow = el('div', 'group-card__top');
  const icon = el('div', 'group-card__icon', initials(group.name));
  icon.style.background = group.color;
  const nameWrap = document.createElement('div');
  nameWrap.appendChild(el('h2', null, group.name));
  topRow.append(icon, nameWrap);
  viewRoot.appendChild(topRow);

  const grid = el('div', 'dash-grid');
  grid.style.marginTop = '1.5rem';

  const expensesPanel = el('div', 'panel');
  const expHead = el('div', 'panel__head');
  expHead.appendChild(el('h2', null, 'Group expenses'));
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--primary'; addBtn.type = 'button'; addBtn.textContent = 'Add expense';
  addBtn.addEventListener('click', () => openAddExpenseModal({ group_id: group.id }));
  expHead.appendChild(addBtn);
  expensesPanel.appendChild(expHead);

  const groupExpenses = store.expenses.filter(e => e.group_id === group.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (groupExpenses.length === 0) {
    expensesPanel.appendChild(buildEmptyState('No expenses in this group yet.', 'Add the first shared expense.'));
  } else {
    groupExpenses.forEach(exp => expensesPanel.appendChild(buildExpenseRow(exp)));
  }
  grid.appendChild(expensesPanel);

  const membersPanel = el('div', 'panel');
  const memHead = el('div', 'panel__head');
  memHead.appendChild(el('h2', null, 'Members'));
  if (group.owner_id === store.user.id) {
    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'btn--icon'; inviteBtn.type = 'button';
    const inviteIcon = el('span', 'nav-link__icon'); inviteIcon.innerHTML = ICONS.userPlus;
    inviteBtn.appendChild(inviteIcon);
    inviteBtn.setAttribute('aria-label', 'Invite member');
    inviteBtn.addEventListener('click', () => openInviteModal(group.id));
    memHead.appendChild(inviteBtn);
  }
  membersPanel.appendChild(memHead);

  const members = await fetchGroupMembers(group.id);
  const totalsByMember = new Map();
  groupExpenses.forEach(e => totalsByMember.set(e.user_id, (totalsByMember.get(e.user_id) || 0) + Number(e.amount)));

  members.forEach(member => {
    const row = el('div', 'member-row');
    const info = el('div', 'member-row__info');
    const avatar = el('span', 'avatar', initials(member.full_name));
    avatar.style.background = member.avatar_color || '#6D5AE6';
    avatar.style.width = '32px'; avatar.style.height = '32px'; avatar.style.fontSize = '0.75rem';
    const nameWrap2 = document.createElement('div');
    nameWrap2.appendChild(el('div', 'member-row__name', member.full_name));
    if (member.role === 'owner') nameWrap2.appendChild(el('div', 'category-card__default', 'Owner'));
    info.append(avatar, nameWrap2);
    row.appendChild(info);
    row.appendChild(el('span', 'member-row__total', formatCurrency(totalsByMember.get(member.id) || 0)));
    membersPanel.appendChild(row);
  });

  grid.appendChild(membersPanel);
  viewRoot.appendChild(grid);
}

// ---------------------------------------------------------
// PROFILE
// ---------------------------------------------------------
function renderProfileView() {
  viewRoot.innerHTML = '';
  const card = el('div', 'panel profile-card');

  const head = el('div', 'profile-card__head');
  const avatar = el('span', 'avatar avatar--lg', initials(store.profile.full_name));
  avatar.style.background = store.profile.avatar_color;
  const headInfo = document.createElement('div');
  headInfo.appendChild(el('h2', null, store.profile.full_name));
  headInfo.appendChild(el('p', null, store.profile.email));
  head.append(avatar, headInfo);
  card.appendChild(head);

  const form = document.createElement('form');

  const nameField = el('div', 'field');
  nameField.appendChild(el('label', null, 'Full name'));
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = store.profile.full_name; nameInput.maxLength = 60;
  nameField.appendChild(nameInput);
  form.appendChild(nameField);

  const currencyField = el('div', 'field');
  currencyField.appendChild(el('label', null, 'Currency'));
  const currencySelect = document.createElement('select');
  ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'].forEach(cur => {
    const opt = document.createElement('option');
    opt.value = cur; opt.textContent = cur;
    if (cur === store.profile.currency) opt.selected = true;
    currencySelect.appendChild(opt);
  });
  currencyField.appendChild(currencySelect);
  form.appendChild(currencyField);

  const colorField = el('div', 'field');
  colorField.appendChild(el('label', null, 'Avatar color'));
  const picker = el('div', 'swatch-picker');
  let chosenColor = store.profile.avatar_color;
  buildSwatchPicker(picker, chosenColor, c => chosenColor = c);
  colorField.appendChild(picker);
  form.appendChild(colorField);

  const feedback = el('p', 'form-feedback');
  form.appendChild(feedback);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit'; saveBtn.className = 'btn btn--primary'; saveBtn.textContent = 'Save changes';
  form.appendChild(saveBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { feedback.textContent = 'Name cannot be empty.'; feedback.style.color = 'var(--danger)'; return; }
    const result = await updateProfile({ full_name: name, currency: currencySelect.value, avatar_color: chosenColor });
    if (result.error) { feedback.textContent = 'Could not save changes.'; feedback.style.color = 'var(--danger)'; return; }
    feedback.style.color = 'var(--accent-2)';
    feedback.textContent = 'Saved.';
    window.onDataChanged?.(true);
  });

  card.appendChild(form);
  viewRoot.appendChild(card);
}
