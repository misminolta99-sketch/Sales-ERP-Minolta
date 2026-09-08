// ============================================================
// filters.js — advanced filter panel (multi-select, searchable,
// numeric ranges, save/apply/reset, remembers last filter)
// ============================================================
import { parseAnyDate, toast } from './utils.js';

const MULTI_FIELDS = [
  { key: 'sellingParty', label: 'Selling Party' },
  { key: 'purchasedParty', label: 'Purchased Party' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'item', label: 'Item' },
  { key: 'salesPerson', label: 'Sales Person' },
  { key: 'transport', label: 'Transport' },
  { key: 'status', label: 'Status' },
];
const RANGE_FIELDS = [
  { key: 'qty', label: 'Quantity' },
  { key: 'purchase', label: 'Purchase Price' },
  { key: 'selling', label: 'Selling Price' },
  { key: 'margin', label: 'Margin' },
];

const LAST_FILTER_KEY = 'erp_last_filter';
const SAVED_FILTERS_KEY = 'erp_saved_filters';

export function emptyFilterState() {
  const state = { dateFrom: '', dateTo: '', invoice: '' };
  MULTI_FIELDS.forEach((f) => { state[f.key] = []; });
  RANGE_FIELDS.forEach((f) => { state[f.key + 'Min'] = ''; state[f.key + 'Max'] = ''; });
  return state;
}

export function buildFilterBar(mount, rows, onApply) {
  const uniques = {};
  MULTI_FIELDS.forEach((f) => { uniques[f.key] = [...new Set(rows.map((r) => (r[f.key] || '').toString().trim()).filter(Boolean))].sort(); });

  let state = loadLastFilter() || emptyFilterState();
  const openPanels = {};

  mount.innerHTML = `
    <div class="filter-bar">
      <div class="filter-grid" id="filterGrid">
        <div class="field">
          <label>Date From</label>
          <input type="date" id="f_dateFrom" value="${state.dateFrom}" />
        </div>
        <div class="field">
          <label>Date To</label>
          <input type="date" id="f_dateTo" value="${state.dateTo}" />
        </div>
        <div class="field">
          <label>Invoice No.</label>
          <input type="text" id="f_invoice" placeholder="e.g. MG09" value="${state.invoice}" />
        </div>
        ${MULTI_FIELDS.map((f) => multiSelectMarkup(f)).join('')}
        ${RANGE_FIELDS.map((f) => `
          <div class="field">
            <label>${f.label} (min–max)</label>
            <div style="display:flex;gap:6px;">
              <input type="number" id="f_${f.key}Min" placeholder="Min" value="${state[f.key + 'Min']}" />
              <input type="number" id="f_${f.key}Max" placeholder="Max" value="${state[f.key + 'Max']}" />
            </div>
          </div>`).join('')}
      </div>
      <div class="filter-actions">
        <div class="left" id="activeChips"></div>
        <div class="right">
          <button class="btn btn-ghost btn-sm" id="btnReset">Reset Filter</button>
          <button class="btn btn-ghost btn-sm" id="btnSave">Save Filter</button>
          <select class="btn btn-ghost btn-sm" id="savedFiltersSelect" style="padding:7px 8px;"></select>
          <button class="btn btn-primary btn-sm" id="btnApply">Apply Filter</button>
        </div>
      </div>
    </div>
  `;

  MULTI_FIELDS.forEach((f) => wireMultiSelect(mount, f, uniques[f.key], state));

  const apply = () => {
    state.dateFrom = mount.querySelector('#f_dateFrom').value;
    state.dateTo = mount.querySelector('#f_dateTo').value;
    state.invoice = mount.querySelector('#f_invoice').value.trim();
    RANGE_FIELDS.forEach((f) => {
      state[f.key + 'Min'] = mount.querySelector(`#f_${f.key}Min`).value;
      state[f.key + 'Max'] = mount.querySelector(`#f_${f.key}Max`).value;
    });
    localStorage.setItem(LAST_FILTER_KEY, JSON.stringify(state));
    renderChips(mount, state, () => { apply(); });
    onApply(state);
  };

  mount.querySelector('#btnApply').addEventListener('click', apply);
  mount.querySelector('#btnReset').addEventListener('click', () => {
    state = emptyFilterState();
    localStorage.removeItem(LAST_FILTER_KEY);
    buildFilterBar(mount, rows, onApply); // rebuild fresh
    onApply(state);
  });
  mount.querySelector('#btnSave').addEventListener('click', () => {
    const name = prompt('Name this filter:');
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '{}');
    saved[name] = state;
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(saved));
    toast(`Filter "${name}" saved`, 'success');
    populateSavedFilters(mount);
  });
  populateSavedFilters(mount);
  mount.querySelector('#savedFiltersSelect').addEventListener('change', (e) => {
    const saved = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '{}');
    const picked = saved[e.target.value];
    if (!picked) return;
    state = picked;
    buildFilterBar(mount, rows, onApply);
    onApply(state);
  });

  renderChips(mount, state, apply);
  return { getState: () => state, apply };
}

function populateSavedFilters(mount) {
  const sel = mount.querySelector('#savedFiltersSelect');
  const saved = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '{}');
  sel.innerHTML = `<option value="">Saved filters…</option>` + Object.keys(saved).map((n) => `<option value="${n}">${n}</option>`).join('');
}

function multiSelectMarkup(f) {
  return `
    <div class="field">
      <label>${f.label}</label>
      <div class="ms-wrap" style="position:relative;">
        <button type="button" class="btn btn-ghost btn-sm ms-toggle" data-key="${f.key}" style="width:100%;justify-content:space-between;">
          <span id="ms_label_${f.key}">All</span><span>▾</span>
        </button>
        <div class="ms-panel hidden" id="ms_panel_${f.key}" style="position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);z-index:30;margin-top:4px;max-height:240px;overflow-y:auto;padding:8px;">
          <input type="text" placeholder="Search…" class="ms-search" style="width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg-alt);color:var(--text);" />
          <div class="ms-options"></div>
        </div>
      </div>
    </div>`;
}

function wireMultiSelect(mount, f, options, state) {
  const toggle = mount.querySelector(`.ms-toggle[data-key="${f.key}"]`);
  const panel = mount.querySelector(`#ms_panel_${f.key}`);
  const optsWrap = panel.querySelector('.ms-options');
  const searchInput = panel.querySelector('.ms-search');
  const label = mount.querySelector(`#ms_label_${f.key}`);
  const selected = new Set(state[f.key] || []);

  const draw = (filterTxt = '') => {
    const list = options.filter((o) => o.toLowerCase().includes(filterTxt.toLowerCase()));
    optsWrap.innerHTML = list.slice(0, 200).map((o) => `
      <label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12.5px;cursor:pointer;">
        <input type="checkbox" value="${o.replace(/"/g,'&quot;')}" ${selected.has(o) ? 'checked' : ''} />
        <span style="overflow:hidden;text-overflow:ellipsis;">${o}</span>
      </label>`).join('') || `<div class="text-mute" style="font-size:12px;padding:6px;">No matches</div>`;
    optsWrap.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(cb.value); else selected.delete(cb.value);
        state[f.key] = [...selected];
        updateLabel();
      });
    });
  };
  const updateLabel = () => { label.textContent = selected.size ? `${selected.size} selected` : 'All'; };

  draw(); updateLabel();
  searchInput.addEventListener('input', (e) => draw(e.target.value));
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ms-panel').forEach((p) => { if (p !== panel) p.classList.add('hidden'); });
    panel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== toggle) panel.classList.add('hidden'); });
}

function renderChips(mount, state, onRemove) {
  const chipsEl = mount.querySelector('#activeChips');
  const chips = [];
  if (state.dateFrom) chips.push(['Date ≥ ' + state.dateFrom, () => { state.dateFrom = ''; }]);
  if (state.dateTo) chips.push(['Date ≤ ' + state.dateTo, () => { state.dateTo = ''; }]);
  if (state.invoice) chips.push(['Invoice: ' + state.invoice, () => { state.invoice = ''; }]);
  MULTI_FIELDS.forEach((f) => { if (state[f.key]?.length) chips.push([`${f.label}: ${state[f.key].length}`, () => { state[f.key] = []; }]); });
  RANGE_FIELDS.forEach((f) => {
    if (state[f.key+'Min']) chips.push([`${f.label} ≥ ${state[f.key+'Min']}`, () => { state[f.key+'Min'] = ''; }]);
    if (state[f.key+'Max']) chips.push([`${f.label} ≤ ${state[f.key+'Max']}`, () => { state[f.key+'Max'] = ''; }]);
  });
  chipsEl.innerHTML = chips.length
    ? chips.map(([txt], i) => `<span class="chip">${txt}<button data-i="${i}">✕</button></span>`).join('')
    : `<span class="text-mute" style="font-size:12px;">No filters applied</span>`;
  chipsEl.querySelectorAll('button').forEach((btn, i) => {
    btn.addEventListener('click', () => { chips[i][1](); onRemove(); buildFilterBar.rebuildHint?.(); });
  });
}

export function applyFilters(rows, state) {
  return rows.filter((r) => {
    if (state.dateFrom || state.dateTo) {
      const d = parseAnyDate(r.date);
      if (!d) return false;
      if (state.dateFrom && d < new Date(state.dateFrom)) return false;
      if (state.dateTo && d > new Date(state.dateTo + 'T23:59:59')) return false;
    }
    if (state.invoice && !r.invoice?.toLowerCase().includes(state.invoice.toLowerCase())) return false;
    for (const f of MULTI_FIELDS) {
      if (state[f.key]?.length && !state[f.key].includes((r[f.key] || '').toString().trim())) return false;
    }
    for (const f of RANGE_FIELDS) {
      const val = f.key === 'margin' ? (Number(r.selling)||0) - (Number(r.purchase)||0) : Number(r[f.key]) || 0;
      const min = state[f.key + 'Min'], max = state[f.key + 'Max'];
      if (min !== '' && val < Number(min)) return false;
      if (max !== '' && val > Number(max)) return false;
    }
    return true;
  });
}

function loadLastFilter() {
  try {
    const raw = localStorage.getItem(LAST_FILTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
