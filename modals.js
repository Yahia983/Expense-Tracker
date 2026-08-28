/**
 * modals.js
 * ---------------------------------------------------------
 * All modal open/close logic and their form submit handlers.
 * Each modal follows the same shape: open(prefill) -> user
 * submits -> validate via data.js -> on success, close + toast
 * + tell router.js to re-render the current view.
 */

const modalDom = {
  expenseOverlay: document.getElementById('expense-modal-overlay'),
  expenseForm: document.getElementById('expense-form'),
  expenseTitle: document.getElementById('exp-title'),
  expenseAmount: document.getElementById('exp-amount'),
  expenseDate: document.getElementById('exp-date'),
  expenseCategory: document.getElementById('exp-category'),
  expenseGroup: document.getElementById('exp-group'),
  expenseNotes: document.getElementById('exp-notes'),
  expenseModalTitle: document.getElementById('expense-modal-title'),
  expenseSaveBtn: document.getElementById('expense-save-btn'),
  expenseDeleteBtn: document.getElementById('expense-delete-btn'),
  expenseFeedback: document.getElementById('expense-form-feedback'),

  categoryOverlay: document.getElementById('category-modal-overlay'),
  categoryForm: document.getElementById('category-form'),
  categoryName: document.getElementById('cat-name'),
  categoryPicker: document.getElementById('cat-color-picker'),
  categoryFeedback: document.getElementById('category-form-feedback'),

  groupOverlay: document.getElementById('group-modal-overlay'),
  groupForm: document.getElementById('group-form'),
  groupName: document.getElementById('group-name'),
  groupPicker: document.getElementById('group-color-picker'),
  groupFeedback: document.getElementById('group-form-feedback'),

  inviteOverlay: document.getElementById('invite-modal-overlay'),
  inviteForm: document.getElementById('invite-form'),
  inviteEmail: document.getElementById('invite-email'),
  inviteFeedback: document.getElementById('invite-form-feedback'),

  confirmOverlay: document.getElementById('confirm-overlay'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmBody: document.getElementById('confirm-body'),
  confirmOk: document.getElementById('confirm-ok'),
  confirmCancel: document.getElementById('confirm-cancel'),
};

let editingExpenseId = null;
let selectedCategoryColor = CATEGORY_COLORS[0];
let selectedGroupColor = CATEGORY_COLORS[0];
let activeInviteGroupId = null;
let confirmAction = null;

function clearFieldErrors(scope) {
  scope.querySelectorAll('.field__error').forEach(el => el.textContent = '');
  scope.querySelectorAll('.field--invalid').forEach(el => el.classList.remove('field--invalid'));
}
function showFieldErrors(scope, errors) {
  clearFieldErrors(scope);
  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = scope.querySelector(`#error-${field}, #exp-error-${field}, #cat-error-${field}, #group-error-${field}, #invite-error-${field}`);
    if (errorEl) errorEl.textContent = message;
    const inputEl = scope.querySelector(`#${field}, #exp-${field}, #cat-${field}, #group-${field}, #invite-${field}`);
    if (inputEl) inputEl.closest('.field')?.classList.add('field--invalid');
  });
}

function buildSwatchPicker(container, selectedColor, onSelect) {
  container.innerHTML = '';
  CATEGORY_COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `swatch${color === selectedColor ? ' is-selected' : ''}`;
    btn.style.background = color;
    btn.setAttribute('aria-label', `Choose color ${color}`);
    btn.addEventListener('click', () => {
      container.querySelectorAll('.swatch').forEach(s => s.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      onSelect(color);
    });
    container.appendChild(btn);
  });
}

// ---------------------------------------------------------
// EXPENSE MODAL
// ---------------------------------------------------------
function populateExpenseCategoryOptions() {
  modalDom.expenseCategory.innerHTML = '<option value="">Choose a category\u2026</option>';
  store.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    modalDom.expenseCategory.appendChild(opt);
  });
}
function populateExpenseGroupOptions() {
  modalDom.expenseGroup.innerHTML = '<option value="">Personal (just me)</option>';
  store.groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    modalDom.expenseGroup.appendChild(opt);
  });
}

function openAddExpenseModal(defaults = {}) {
  editingExpenseId = null;
  populateExpenseCategoryOptions();
  populateExpenseGroupOptions();
  modalDom.expenseForm.reset();
  modalDom.expenseDate.valueAsDate = new Date();
  if (defaults.group_id) modalDom.expenseGroup.value = defaults.group_id;
  modalDom.expenseModalTitle.textContent = 'Add expense';
  modalDom.expenseSaveBtn.textContent = 'Add expense';
  modalDom.expenseDeleteBtn.hidden = true;
  clearFieldErrors(modalDom.expenseForm);
  modalDom.expenseFeedback.textContent = '';
  modalDom.expenseOverlay.hidden = false;
  modalDom.expenseTitle.focus();
}

function openEditExpenseModal(expense) {
  editingExpenseId = expense.id;
  populateExpenseCategoryOptions();
  populateExpenseGroupOptions();
  modalDom.expenseTitle.value = expense.title;
  modalDom.expenseAmount.value = expense.amount;
  modalDom.expenseDate.value = expense.date;
  modalDom.expenseCategory.value = expense.category_id || '';
  modalDom.expenseGroup.value = expense.group_id || '';
  modalDom.expenseNotes.value = expense.notes || '';
  modalDom.expenseModalTitle.textContent = 'Edit expense';
  modalDom.expenseSaveBtn.textContent = 'Save changes';
  modalDom.expenseDeleteBtn.hidden = false;
  clearFieldErrors(modalDom.expenseForm);
  modalDom.expenseFeedback.textContent = '';
  modalDom.expenseOverlay.hidden = false;
  modalDom.expenseTitle.focus();
}

function closeExpenseModal() { modalDom.expenseOverlay.hidden = true; editingExpenseId = null; }

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const input = {
    title: modalDom.expenseTitle.value,
    amount: modalDom.expenseAmount.value,
    category_id: modalDom.expenseCategory.value,
    date: modalDom.expenseDate.value,
    notes: modalDom.expenseNotes.value,
    group_id: modalDom.expenseGroup.value || null,
  };

  modalDom.expenseSaveBtn.disabled = true;
  const result = editingExpenseId
    ? await updateExpense(editingExpenseId, input)
    : await addExpense(input);
  modalDom.expenseSaveBtn.disabled = false;

  if (!result.success) {
    if (result.errors.category) showFieldErrors(modalDom.expenseForm, { category: result.errors.category });
    showFieldErrors(modalDom.expenseForm, result.errors);
    return;
  }

  closeExpenseModal();
  showToast(editingExpenseId ? 'Expense updated.' : 'Expense added.', 'success');
  window.onDataChanged?.();
}

async function handleExpenseDelete() {
  if (!editingExpenseId) return;
  openConfirmDialog({
    title: 'Delete this expense?',
    body: 'This can\u2019t be undone.',
    onConfirm: async () => {
      const id = editingExpenseId;
      const result = await deleteExpense(id);
      if (result.success) {
        closeExpenseModal();
        showToast('Expense deleted.', 'default');
        window.onDataChanged?.();
      } else {
        showToast('Could not delete this expense.', 'danger');
      }
    }
  });
}

// ---------------------------------------------------------
// CATEGORY MODAL
// ---------------------------------------------------------
function openAddCategoryModal() {
  modalDom.categoryForm.reset();
  selectedCategoryColor = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
  buildSwatchPicker(modalDom.categoryPicker, selectedCategoryColor, c => selectedCategoryColor = c);
  clearFieldErrors(modalDom.categoryForm);
  modalDom.categoryFeedback.textContent = '';
  modalDom.categoryOverlay.hidden = false;
  modalDom.categoryName.focus();
}
function closeCategoryModal() { modalDom.categoryOverlay.hidden = true; }

async function handleCategorySubmit(event) {
  event.preventDefault();
  const result = await addCategory({ name: modalDom.categoryName.value, color: selectedCategoryColor });
  if (!result.success) {
    showFieldErrors(modalDom.categoryForm, result.errors);
    return;
  }
  closeCategoryModal();
  showToast('Category added.', 'success');
  window.onDataChanged?.();
}

// ---------------------------------------------------------
// GROUP MODAL
// ---------------------------------------------------------
function openCreateGroupModal() {
  modalDom.groupForm.reset();
  selectedGroupColor = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
  buildSwatchPicker(modalDom.groupPicker, selectedGroupColor, c => selectedGroupColor = c);
  clearFieldErrors(modalDom.groupForm);
  modalDom.groupFeedback.textContent = '';
  modalDom.groupOverlay.hidden = false;
  modalDom.groupName.focus();
}
function closeGroupModal() { modalDom.groupOverlay.hidden = true; }

async function handleGroupSubmit(event) {
  event.preventDefault();
  const result = await createGroup({ name: modalDom.groupName.value, color: selectedGroupColor });
  if (!result.success) {
    showFieldErrors(modalDom.groupForm, result.errors);
    return;
  }
  closeGroupModal();
  showToast('Group created.', 'success');
  window.onDataChanged?.();
}

// ---------------------------------------------------------
// INVITE MODAL
// ---------------------------------------------------------
function openInviteModal(groupId) {
  activeInviteGroupId = groupId;
  modalDom.inviteForm.reset();
  clearFieldErrors(modalDom.inviteForm);
  modalDom.inviteFeedback.textContent = '';
  modalDom.inviteOverlay.hidden = false;
  modalDom.inviteEmail.focus();
}
function closeInviteModal() { modalDom.inviteOverlay.hidden = true; activeInviteGroupId = null; }

async function handleInviteSubmit(event) {
  event.preventDefault();
  const result = await inviteMemberByEmail(activeInviteGroupId, modalDom.inviteEmail.value);
  if (!result.success) {
    showFieldErrors(modalDom.inviteForm, result.errors);
    return;
  }
  closeInviteModal();
  showToast(`${result.name} added to the group.`, 'success');
  window.onDataChanged?.();
}

// ---------------------------------------------------------
// CONFIRM DIALOG (generic, reused for delete actions everywhere)
// ---------------------------------------------------------
function openConfirmDialog({ title, body, onConfirm }) {
  modalDom.confirmTitle.textContent = title;
  modalDom.confirmBody.textContent = body;
  confirmAction = onConfirm;
  modalDom.confirmOverlay.hidden = false;
  modalDom.confirmOk.focus();
}
function closeConfirmDialog() { modalDom.confirmOverlay.hidden = true; confirmAction = null; }

function bindModalEvents() {
  modalDom.expenseForm.addEventListener('submit', handleExpenseSubmit);
  document.getElementById('expense-cancel-btn').addEventListener('click', closeExpenseModal);
  document.getElementById('expense-modal-close').addEventListener('click', closeExpenseModal);
  modalDom.expenseDeleteBtn.addEventListener('click', handleExpenseDelete);

  modalDom.categoryForm.addEventListener('submit', handleCategorySubmit);
  document.getElementById('category-cancel-btn').addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-close').addEventListener('click', closeCategoryModal);

  modalDom.groupForm.addEventListener('submit', handleGroupSubmit);
  document.getElementById('group-cancel-btn').addEventListener('click', closeGroupModal);
  document.getElementById('group-modal-close').addEventListener('click', closeGroupModal);

  modalDom.inviteForm.addEventListener('submit', handleInviteSubmit);
  document.getElementById('invite-cancel-btn').addEventListener('click', closeInviteModal);
  document.getElementById('invite-modal-close').addEventListener('click', closeInviteModal);

  modalDom.confirmCancel.addEventListener('click', closeConfirmDialog);
  modalDom.confirmOk.addEventListener('click', async () => {
    const action = confirmAction;
    closeConfirmDialog();
    if (action) await action();
  });

  // Click-outside-to-close for every overlay.
  [modalDom.expenseOverlay, modalDom.categoryOverlay, modalDom.groupOverlay, modalDom.inviteOverlay, modalDom.confirmOverlay]
    .forEach(overlay => overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    [modalDom.expenseOverlay, modalDom.categoryOverlay, modalDom.groupOverlay, modalDom.inviteOverlay, modalDom.confirmOverlay]
      .forEach(overlay => overlay.hidden = true);
  });
}
