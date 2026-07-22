const state = {
  categories: [],
  currentCategoryId: null,
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
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.style.setProperty('--chip-color', cat.color);
    const totalUses = cat.variations.reduce((a, v) => a + v.times_used, 0);
    btn.innerHTML = `
      <span class="chip-name">${escapeHtml(cat.name)}</span>
      <span class="chip-meta">${cat.variations.length} variante${cat.variations.length === 1 ? '' : 's'} · usado ${totalUses}x</span>
    `;
    btn.addEventListener('click', () => pickAndShow(cat.id, cat.name));
    grid.appendChild(btn);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------------------------------------------------------------------
// Picking a variation + clipboard copy
// ---------------------------------------------------------------------

async function pickAndShow(catId, catName) {
  state.currentCategoryId = catId;
  const res = await fetch(`/api/categories/${catId}/pick`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'No se pudo elegir una respuesta.');
    return;
  }
  showResult(catName, data.text);
  await copyToClipboard(data.text);
  // refresh usage counters in the background
  loadCategories();
}

function showResult(catName, text) {
  el('resultCatName').textContent = catName;
  el('resultText').textContent = text;
  el('resultOverlay').classList.remove('hidden');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showCopiedToast();
  } catch (e) {
    // Clipboard API can fail without HTTPS/focus in some setups; the text
    // is still visible in the card so she can select & copy manually.
    console.warn('No se pudo copiar automáticamente', e);
  }
}

function showCopiedToast() {
  const toast = el('copiedToast');
  toast.classList.remove('hidden');
  clearTimeout(showCopiedToast._t);
  showCopiedToast._t = setTimeout(() => toast.classList.add('hidden'), 1600);
}

el('copyAgainBtn').addEventListener('click', () => {
  copyToClipboard(el('resultText').textContent);
});

el('rerollBtn').addEventListener('click', () => {
  const catName = el('resultCatName').textContent;
  pickAndShow(state.currentCategoryId, catName);
});

el('closeResultBtn').addEventListener('click', () => {
  el('resultOverlay').classList.add('hidden');
});
el('resultOverlay').addEventListener('click', (e) => {
  if (e.target === el('resultOverlay')) el('resultOverlay').classList.add('hidden');
});

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
// Init
// ---------------------------------------------------------------------

loadCategories();
