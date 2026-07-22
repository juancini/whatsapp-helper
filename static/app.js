const state = {
  categories: [],
  currentCategoryId: null,
  lastCopiedByCat: {},
};

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

async function loadCategories() {
  const res = await fetch('/api/categories');
  state.categories = await res.json();
  renderGrid();
  renderManageList();
}

// ---------------------------------------------------------------------
// Main grid (quick-reply chips)
// ---------------------------------------------------------------------

function renderGrid(filterText = '') {
  const grid = el('mainView');
  const empty = el('emptyState');
  grid.innerHTML = '';

  const term = filterText.trim().toLowerCase();
  const visible = state.categories.filter((c) => {
    if (!term) return true;
    if (c.name.toLowerCase().includes(term)) return true;
    return c.variations.some((v) => v.text.toLowerCase().includes(term));
  });

  if (state.categories.length === 0) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  if (visible.length === 0) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.style.gridColumn = '1 / -1';
    p.textContent = 'No encontramos ninguna respuesta con esa búsqueda.';
    grid.appendChild(p);
    return;
  }

  visible.forEach((cat) => {
    const card = document.createElement('div');
    card.className = 'chip';
    card.dataset.id = cat.id;
    card.style.setProperty('--chip-color', cat.color);
    const totalUses = cat.variations.reduce((a, v) => a + v.times_used, 0);
    const lastCopied = state.lastCopiedByCat[cat.id];

    card.innerHTML = `
      <div class="chip-header">
        <span class="chip-name">${escapeHtml(cat.name)}</span>
        <div class="chip-header-actions">
          <span class="chip-badge ${lastCopied ? 'visible' : ''}">✓ Copiado</span>
          <button class="chip-options-btn" title="Editar este botón y sus variaciones">⋮</button>
        </div>
      </div>
      <span class="chip-meta">${cat.variations.length} variante${cat.variations.length === 1 ? '' : 's'} · usado <span class="use-count">${totalUses}</span>x</span>
      <div class="chip-preview ${lastCopied ? '' : 'hidden'}">
        <span class="chip-preview-label">Último copiado:</span>
        <span class="preview-text">${lastCopied ? escapeHtml(lastCopied) : ''}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.chip-options-btn')) return;
      pickAndCopy(cat.id, card);
    });

    const optBtn = card.querySelector('.chip-options-btn');
    if (optBtn) {
      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openQuickEditModal(cat.id);
      });
    }

    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------
// Quick Edit Modal logic
// ---------------------------------------------------------------------

let activeEditCatId = null;

async function openQuickEditModal(catId) {
  activeEditCatId = catId;
  const cat = state.categories.find((c) => c.id === catId);
  if (!cat) return;

  el('editModalCatName').value = cat.name;
  el('editModalCatColor').value = cat.color;
  el('editModalNewVarText').value = '';

  renderQuickEditVariations(cat);
  el('quickEditModal').classList.remove('hidden');
}

function renderQuickEditVariations(cat) {
  const container = el('editModalVariationsList');
  container.innerHTML = '';

  if (!cat.variations || cat.variations.length === 0) {
    container.innerHTML = '<p style="color: var(--muted); font-size: 13px; text-align: center; padding: 12px 0;">No hay respuestas guardadas aún. Escribí una abajo.</p>';
    return;
  }

  cat.variations.forEach((v) => {
    const row = document.createElement('div');
    row.className = 'modal-var-row';

    const ta = document.createElement('textarea');
    ta.value = v.text;
    ta.placeholder = 'Escribí la variación...';
    ta.addEventListener('change', async () => {
      await updateVariation(v.id, ta.value);
    });

    const stats = document.createElement('span');
    stats.className = 'var-stats';
    stats.textContent = `usado ${v.times_used}x`;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-small';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Eliminar variante';
    delBtn.addEventListener('click', async () => {
      await deleteVariation(v.id);
      const catObj = state.categories.find((c) => c.id === activeEditCatId);
      if (catObj) renderQuickEditVariations(catObj);
    });

    row.appendChild(ta);
    row.appendChild(stats);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function closeQuickEditModal() {
  el('quickEditModal').classList.add('hidden');
  renderGrid(el('searchInput').value);
}

el('closeEditModalBtn').addEventListener('click', closeQuickEditModal);
el('editModalDoneBtn').addEventListener('click', closeQuickEditModal);

el('editModalCatName').addEventListener('change', async () => {
  if (!activeEditCatId) return;
  const name = el('editModalCatName').value.trim();
  if (name) {
    await updateCategory(activeEditCatId, { name });
  }
});

el('editModalCatColor').addEventListener('change', async () => {
  if (!activeEditCatId) return;
  const color = el('editModalCatColor').value;
  await updateCategory(activeEditCatId, { color });
});

el('editModalAddVarBtn').addEventListener('click', async () => {
  if (!activeEditCatId) return;
  const text = el('editModalNewVarText').value.trim();
  if (!text) {
    el('editModalNewVarText').focus();
    return;
  }
  await addVariation(activeEditCatId, text);
  el('editModalNewVarText').value = '';
  const catObj = state.categories.find((c) => c.id === activeEditCatId);
  if (catObj) renderQuickEditVariations(catObj);
});

el('editModalDeleteCatBtn').addEventListener('click', async () => {
  if (!activeEditCatId) return;
  const catObj = state.categories.find((c) => c.id === activeEditCatId);
  const name = catObj ? catObj.name : 'este botón';
  if (confirm(`¿Eliminar "${name}" y todas sus respuestas?`)) {
    await deleteCategory(activeEditCatId);
    closeQuickEditModal();
  }
});

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------------------------------------------------------------------
// Single-click picking + clipboard copy
// ---------------------------------------------------------------------

async function pickAndCopy(catId, btnElement) {
  // Trigger click animation
  btnElement.classList.remove('copied-flash');
  void btnElement.offsetWidth; // force reflow
  btnElement.classList.add('copied-flash');

  const res = await fetch(`/api/categories/${catId}/pick`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'No se pudo elegir una respuesta.');
    return;
  }

  // 1. Copy to clipboard
  await copyToClipboard(data.text);

  // 2. Save in state
  state.lastCopiedByCat[catId] = data.text;

  // 3. Update chip inline
  const badge = btnElement.querySelector('.chip-badge');
  const preview = btnElement.querySelector('.chip-preview');
  const previewText = btnElement.querySelector('.preview-text');

  if (badge) badge.classList.add('visible');
  if (preview) preview.classList.remove('hidden');
  if (previewText) previewText.textContent = data.text;

  // 4. Show global floating notification
  showGlobalToast(`"${data.text}"`);

  // 5. Refresh categories usage in background
  const resCats = await fetch('/api/categories');
  state.categories = await resCats.json();
  const catObj = state.categories.find((c) => c.id === catId);
  if (catObj && btnElement.querySelector('.use-count')) {
    const totalUses = catObj.variations.reduce((a, v) => a + v.times_used, 0);
    btnElement.querySelector('.use-count').textContent = totalUses;
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.warn('No se pudo copiar automáticamente', e);
  }
}

function showGlobalToast(text) {
  const toast = el('globalToast');
  const toastText = el('toastText');
  if (!toast || !toastText) return;

  toastText.textContent = text;
  toast.classList.remove('hidden');

  clearTimeout(showGlobalToast._t);
  showGlobalToast._t = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ---------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------

el('searchInput').addEventListener('input', (e) => renderGrid(e.target.value));

// ---------------------------------------------------------------------
// Manage view
// ---------------------------------------------------------------------

function showManage() {
  el('manageView').classList.remove('hidden');
  el('mainView').classList.add('hidden');
  el('emptyState').classList.add('hidden');
  el('historyView').classList.add('hidden');
  renderManageList();
}
function hideManage() {
  el('manageView').classList.add('hidden');
  el('mainView').classList.remove('hidden');
  renderGrid(el('searchInput').value);
}

el('manageBtn').addEventListener('click', showManage);
el('closeManageBtn').addEventListener('click', hideManage);
el('emptyAddBtn').addEventListener('click', showManage);

el('addCategoryBtn').addEventListener('click', async () => {
  const name = el('newCatName').value.trim();
  const color = el('newCatColor').value;
  if (!name) { el('newCatName').focus(); return; }
  await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, variations: [] }),
  });
  el('newCatName').value = '';
  await loadCategories();
});

function renderManageList() {
  const list = el('manageList');
  list.innerHTML = '';

  state.categories.forEach((cat) => {
    const card = document.createElement('div');
    card.className = 'manage-card';
    card.style.setProperty('--chip-color', cat.color);

    const head = document.createElement('div');
    head.className = 'manage-card-head';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = cat.name;
    nameInput.addEventListener('change', () => updateCategory(cat.id, { name: nameInput.value }));

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = cat.color;
    colorInput.addEventListener('change', () => updateCategory(cat.id, { color: colorInput.value }));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = 'Eliminar botón';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`¿Eliminar "${cat.name}" y todas sus variantes?`)) {
        deleteCategory(cat.id);
      }
    });

    head.appendChild(nameInput);
    head.appendChild(colorInput);
    head.appendChild(deleteBtn);
    card.appendChild(head);

    cat.variations.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'variation-row';

      const ta = document.createElement('textarea');
      ta.value = v.text;
      ta.addEventListener('change', () => updateVariation(v.id, ta.value));

      const stats = document.createElement('div');
      stats.className = 'var-stats';
      stats.textContent = `usado ${v.times_used}x`;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-small';
      delBtn.textContent = '✕';
      delBtn.title = 'Eliminar variante';
      delBtn.addEventListener('click', () => deleteVariation(v.id));

      row.appendChild(ta);
      row.appendChild(stats);
      row.appendChild(delBtn);
      card.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'add-variation-row';
    const addTa = document.createElement('textarea');
    addTa.placeholder = 'Escribí una nueva variante de respuesta y presioná Enter…';
    addTa.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = addTa.value.trim();
        if (text) {
          addVariation(cat.id, text);
          addTa.value = '';
        }
      }
    });
    addRow.appendChild(addTa);
    card.appendChild(addRow);

    list.appendChild(card);
  });
}

async function updateCategory(id, payload) {
  await fetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await loadCategories();
}

async function deleteCategory(id) {
  await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  await loadCategories();
}

async function addVariation(catId, text) {
  await fetch(`/api/categories/${catId}/variations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  await loadCategories();
}

async function updateVariation(id, text) {
  await fetch(`/api/variations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  await loadCategories();
}

async function deleteVariation(id) {
  await fetch(`/api/variations/${id}`, { method: 'DELETE' });
  await loadCategories();
}

// ---------------------------------------------------------------------
// History view
// ---------------------------------------------------------------------

el('historyBtn').addEventListener('click', async () => {
  el('historyView').classList.remove('hidden');
  el('mainView').classList.add('hidden');
  el('emptyState').classList.add('hidden');
  el('manageView').classList.add('hidden');
  await renderHistory();
});
el('closeHistoryBtn').addEventListener('click', () => {
  el('historyView').classList.add('hidden');
  el('mainView').classList.remove('hidden');
  renderGrid(el('searchInput').value);
});
el('clearHistoryBtn').addEventListener('click', async () => {
  if (confirm('¿Borrar todo el historial de mensajes enviados?')) {
    await fetch('/api/history/clear', { method: 'POST' });
    renderHistory();
  }
});

async function renderHistory() {
  const res = await fetch('/api/history?limit=200');
  const items = await res.json();
  const list = el('historyList');
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<p style="color: var(--muted)">Todavía no se envió ningún mensaje.</p>';
    return;
  }
  items.forEach((h) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const date = new Date(h.sent_at);
    div.innerHTML = `
      <div class="h-top"><span class="h-cat">${escapeHtml(h.category_name)}</span><span>${date.toLocaleString('es-AR')}</span></div>
      <div>${escapeHtml(h.text)}</div>
    `;
    list.appendChild(div);
  });
}

// ---------------------------------------------------------------------
// Theme Toggle (Dark / Light)
// ---------------------------------------------------------------------

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  setTheme(isDark ? 'dark' : 'light');
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = el('themeToggleBtn');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }
}

el('themeToggleBtn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

initTheme();
loadCategories();
