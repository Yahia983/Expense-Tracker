/**
 * data.js
 * ---------------------------------------------------------
 * The app's single in-memory store, plus every function that
 * reads or writes to Supabase. Views (views.js) only ever read
 * from `store` and call these functions — they never talk to
 * Supabase directly. That boundary means swapping how data is
 * fetched later never requires touching rendering code.
 */

const CATEGORY_COLORS = [
  '#6D5AE6', '#3B82F6', '#17A398', '#84CC16', '#F59E0B',
  '#E5484D', '#EC4899', '#A78BFA', '#64748B', '#0EA5E9'
];

const store = {
  user: null,
  profile: null,
  categories: [],
  groups: [],          // [{ id, name, color, owner_id, memberCount }]
  expenses: [],         // personal + every group expense the user can see
  view: { search: '', category: 'All', group: 'All', sort: 'newest' }
};

/** Loads everything needed to render the app, in parallel. */
async function loadAllData() {
  const [profile, categories, groups, expenses] = await Promise.all([
    fetchProfile(),
    fetchCategories(),
    fetchGroups(),
    fetchExpenses()
  ]);
  store.profile = profile;
  store.categories = categories;
  store.groups = groups;
  store.expenses = expenses;
}

// ---------------------------------------------------------
// PROFILE
// ---------------------------------------------------------
async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', store.user.id)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

async function updateProfile(fields) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(fields)
    .eq('id', store.user.id)
    .select()
    .single();
  if (!error) store.profile = data;
  return { data, error };
}

// ---------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------
async function fetchCategories() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('user_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

function validateCategoryInput(input, existingNames) {
  const errors = {};
  const name = (input.name || '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 40) errors.name = 'Keep it under 40 characters.';
  else if (existingNames.includes(name.toLowerCase())) errors.name = 'You already have a category with this name.';
  const color = CATEGORY_COLORS.includes(input.color) ? input.color : CATEGORY_COLORS[0];
  return { valid: Object.keys(errors).length === 0, errors, cleaned: { name, color } };
}

async function addCategory(input) {
  const existingNames = store.categories.map(c => c.name.toLowerCase());
  const { valid, errors, cleaned } = validateCategoryInput(input, existingNames);
  if (!valid) return { success: false, errors };

  const { data, error } = await supabaseClient
    .from('categories')
    .insert({ user_id: store.user.id, name: cleaned.name, color: cleaned.color })
    .select()
    .single();
  if (error) return { success: false, errors: { _general: error.message } };

  store.categories.push(data);
  return { success: true, category: data };
}

async function deleteCategory(id) {
  const { error } = await supabaseClient.from('categories').delete().eq('id', id);
  if (error) return { success: false, error };
  store.categories = store.categories.filter(c => c.id !== id);
  return { success: true };
}

// ---------------------------------------------------------
// GROUPS
// ---------------------------------------------------------
async function fetchGroups() {
  const { data: memberships, error } = await supabaseClient
    .from('group_members')
    .select('group_id, groups(id, name, color, owner_id, created_at)')
    .eq('user_id', store.user.id);
  if (error) { console.error(error); return []; }

  const groups = memberships.map(m => m.groups).filter(Boolean);

  // Member counts, one query per group is fine at this scale.
  const withCounts = await Promise.all(groups.map(async g => {
    const { count } = await supabaseClient
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id);
    return { ...g, memberCount: count ?? 1 };
  }));

  return withCounts;
}

async function createGroup(input) {
  const name = (input.name || '').trim();
  if (!name) return { success: false, errors: { name: 'Group name is required.' } };
  if (name.length > 60) return { success: false, errors: { name: 'Keep it under 60 characters.' } };
  const color = CATEGORY_COLORS.includes(input.color) ? input.color : CATEGORY_COLORS[0];

  const { data, error } = await supabaseClient
    .from('groups')
    .insert({ name, color, owner_id: store.user.id })
    .select()
    .single();
  if (error) return { success: false, errors: { _general: error.message } };

  store.groups.push({ ...data, memberCount: 1 });
  return { success: true, group: data };
}

async function fetchGroupMembers(groupId) {
  const { data, error } = await supabaseClient
    .from('group_members')
    .select('user_id, role, profiles(id, full_name, email, avatar_color)')
    .eq('group_id', groupId);
  if (error) { console.error(error); return []; }
  return data.map(row => ({ ...row.profiles, role: row.role }));
}

async function inviteMemberByEmail(groupId, email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, errors: { email: 'Enter a valid email address.' } };
  }

  const { data: profile, error: lookupError } = await supabaseClient
    .from('profiles')
    .select('id, full_name')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (lookupError) return { success: false, errors: { _general: lookupError.message } };
  if (!profile) return { success: false, errors: { email: 'No Ledger account found with that email.' } };

  const { error: insertError } = await supabaseClient
    .from('group_members')
    .insert({ group_id: groupId, user_id: profile.id, role: 'member' });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, errors: { email: 'That person is already in this group.' } };
    }
    return { success: false, errors: { _general: insertError.message } };
  }

  return { success: true, name: profile.full_name };
}

async function leaveOrRemoveMember(groupId, userId) {
  const { error } = await supabaseClient
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  return { success: !error, error };
}

// ---------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------
async function fetchExpenses() {
  const { data, error } = await supabaseClient
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

function validateExpenseInput(input) {
  const errors = {};
  const cleaned = {};

  const title = (input.title || '').trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 80) errors.title = 'Keep it under 80 characters.';
  else cleaned.title = title;

  const rawAmount = String(input.amount ?? '').trim().replace(',', '.');
  const amount = Number(rawAmount);
  if (rawAmount === '' || Number.isNaN(amount)) errors.amount = 'Enter a valid amount.';
  else if (amount <= 0) errors.amount = 'Amount must be greater than 0.';
  else if (amount > 100000000) errors.amount = 'That amount looks too large \u2014 check for a typo.';
  else cleaned.amount = Math.round(amount * 100) / 100;

  if (!input.category_id) errors.category = 'Choose a category.';
  else cleaned.category_id = input.category_id;

  const isWellFormed = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '');
  if (!isWellFormed || Number.isNaN(new Date(input.date + 'T00:00:00').getTime())) {
    errors.date = 'Enter a valid date.';
  } else {
    cleaned.date = input.date;
  }

  const notes = (input.notes || '').trim();
  if (notes.length > 240) errors.notes = 'Keep notes under 240 characters.';
  else cleaned.notes = notes;

  cleaned.group_id = input.group_id || null;

  return { valid: Object.keys(errors).length === 0, errors, cleaned };
}

async function addExpense(input) {
  const { valid, errors, cleaned } = validateExpenseInput(input);
  if (!valid) return { success: false, errors };

  const { data, error } = await supabaseClient
    .from('expenses')
    .insert({ ...cleaned, user_id: store.user.id })
    .select()
    .single();
  if (error) return { success: false, errors: { _general: error.message } };

  store.expenses.unshift(data);
  return { success: true, expense: data };
}

async function updateExpense(id, input) {
  const { valid, errors, cleaned } = validateExpenseInput(input);
  if (!valid) return { success: false, errors };

  const { data, error } = await supabaseClient
    .from('expenses')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single();
  if (error) return { success: false, errors: { _general: error.message } };

  const idx = store.expenses.findIndex(e => e.id === id);
  if (idx !== -1) store.expenses[idx] = data;
  return { success: true, expense: data };
}

async function deleteExpense(id) {
  const { error } = await supabaseClient.from('expenses').delete().eq('id', id);
  if (error) return { success: false, error };
  store.expenses = store.expenses.filter(e => e.id !== id);
  return { success: true };
}

// ---------------------------------------------------------
// DERIVED VIEWS / STATS
// Filter, search, and sort always run as one composed pipeline
// over a COPY of store.expenses, so the underlying data and the
// three view controls can never drift out of sync with each other.
// ---------------------------------------------------------
function categoryById(id) { return store.categories.find(c => c.id === id) || null; }
function groupById(id) { return store.groups.find(g => g.id === id) || null; }

function getVisibleExpenses() {
  let list = store.expenses.slice();
  const { search, category, group, sort } = store.view;

  if (category !== 'All') {
    list = list.filter(e => e.category_id === category);
  }
  if (group === 'Personal') {
    list = list.filter(e => !e.group_id);
  } else if (group !== 'All') {
    list = list.filter(e => e.group_id === group);
  }
  if (search.trim()) {
    const needle = search.trim().toLowerCase();
    list = list.filter(e =>
      e.title.toLowerCase().includes(needle) ||
      (e.notes && e.notes.toLowerCase().includes(needle))
    );
  }

  switch (sort) {
    case 'oldest': list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'highest': list.sort((a, b) => b.amount - a.amount); break;
    case 'lowest': list.sort((a, b) => a.amount - b.amount); break;
    case 'alpha': list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'newest':
    default: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
  }
  return list;
}

function calculateStatistics(list) {
  const count = list.length;
  const total = list.reduce((sum, e) => sum + Number(e.amount), 0);
  const highest = list.reduce((max, e) => (max === null || e.amount > max.amount) ? e : max, null);
  return { count, total, highest };
}

/** Category breakdown for the dashboard donut chart. */
function categoryBreakdown(list) {
  const totals = new Map();
  list.forEach(e => {
    const key = e.category_id || 'uncategorized';
    totals.set(key, (totals.get(key) || 0) + Number(e.amount));
  });
  return Array.from(totals.entries())
    .map(([categoryId, amount]) => ({ category: categoryById(categoryId), amount }))
    .filter(entry => entry.category)
    .sort((a, b) => b.amount - a.amount);
}

function formatCurrency(amount) {
  const currency = store.profile?.currency || 'EGP';
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

// ---------------------------------------------------------
// REALTIME
// Refetches (rather than patches) on any change, so results stay
// correct under Row Level Security regardless of who made the
// change. Debounced so a burst of changes only triggers one refresh.
// ---------------------------------------------------------
let realtimeChannel = null;
let refreshTimer = null;

function subscribeToRealtime(onChange) {
  try {
    realtimeChannel = supabaseClient
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => scheduleRefresh(onChange))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => scheduleRefresh(onChange))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => scheduleRefresh(onChange))
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription unavailable.', err);
  }
}

function scheduleRefresh(onChange) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    await loadAllData();
    onChange();
  }, 400);
}

function unsubscribeFromRealtime() {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
}
