// ============================================================
// table.js — transaction grid: sort / paginate / search / CRUD /
// bulk operations / export (xlsx, csv, print)
// ============================================================
import { getData, insertData, updateData, deleteData, bulkDelete, bulkUpdate, restoreRow } from './api.js';
import { can } from './auth.js';
import {
  $, $$, debounce, toast, confirmDialog, formatDate, formatNumber, formatCurrency,
  calcMargin, csvEscape, downloadBlob, todayFilename, uid,
} from './utils.js';
import { buildFilterBar, applyFilters } from './filters.js';

const COLUMNS = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'invoice', label: 'Invoice', sortable: true },
  { key: 'sellingParty', label: 'Selling Party', sortable: true },
  { key: 'transport', label: 'Transport', sortable: true },
  { key: 'item', label: 'Item', sortable: true },
  { key: 'packing', label: 'Packing', sortable: false },
  { key: 'qty', label: 'Qty', sortable: true, num: true },
  { key: 'purchasedParty', label: 'Purchased Party', sortable: true },
  { key: 'warehouse', label: 'Warehouse', sortable: true },
  { key: 'purchase', label: 'Purchase', sortable: true, num: true },
  { key: 'selling', label: 'Selling', sortable: true, num: true },
  { key: 'margin', label: 'Margin', sortable: true, num: true },
  { key: 'salesPerson', label: 'Sales Person', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
];

const PAGE_SIZE_KEY = 'erp_page_size';
const COLVIS_KEY = 'erp_col_visibility';

let allRows = [];
let filteredRows = [];
let viewRows = [];
let selectedIds = new Set();
let sortKey = 'date';
let sortDir = 'desc';
let page = 1;
let pageSize = Number(localStorage.getItem(PAGE_SIZE_KEY)) || 25;
let searchTerm = '';
let colVisibility = JSON.parse(localStorage.getItem(COLVIS_KEY) || '{}');

export async function initTransactionsPage(root, session) {
  root.innerHTML = `
    <div id="filterMount"></div>
    <div class="table-toolbar">
      <div class="flex items-center gap-2">
        <div class="search-mini" style="width:280px;">
          🔎<input type="text" id="tableSearch" placeholder="Search this table…" />
        </div>
        <span class="text-mute" id="resultCount" style="font-size:12.5px;"></span>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-ghost btn-sm" id="btnColumns">Columns</button>
        <div id="bulkBar" class="hidden flex items-center gap-2"></div>
        ${can('insert') ? `<button class="btn btn-accent btn-sm" id="btnAdd">+ Add Entry</button>` : ''}
        ${can('export') ? `
        <div style="position:relative;">
          <button class="btn btn-primary btn-sm" id="btnExport">Export ▾</button>
          <div class="hidden" id="exportMenu" style="position:absolute;right:0;top:110%;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);min-width:160px;z-index:30;overflow:hidden;">
            <a class="nav-item" style="color:var(--text);" id="expXlsx">Excel (.xlsx)</a>
            <a class="nav-item" style="color:var(--text);" id="expCsv">CSV</a>
            <a class="nav-item" style="color:var(--text);" id="expPrint">Print</a>
          </div>
        </div>` : ''}
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table" id="dataTable">
        <thead><tr></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="pagination" id="pagination"></div>
  `;

  toast('Loading transactions…', 'info', 1400);
  allRows = (await getData()).map((r) => ({ ...r, margin: calcMargin(r.purchase, r.selling) }));
  filteredRows = [...allRows];

  buildFilterBar($('#filterMount'), allRows, (state) => {
    filteredRows = applyFilters(allRows, state);
    page = 1;
    renderTable();
  });

  const pending = sessionStorage.getItem('erp_pending_search');
  if (pending) { searchTerm = pending; $('#tableSearch').value = pending; sessionStorage.removeItem('erp_pending_search'); }

  $('#tableSearch').addEventListener('input', debounce((e) => { searchTerm = e.target.value.trim().toLowerCase(); page = 1; renderTable(); }, 220));

  $('#btnColumns').addEventListener('click', (e) => openColumnMenu(e.currentTarget));

  if (can('insert')) $('#btnAdd').addEventListener('click', () => openEntryModal());

  if (can('export')) {
    $('#btnExport').addEventListener('click', () => $('#exportMenu').classList.toggle('hidden'));
    document.addEventListener('click', (e) => { if (!e.target.closest('#btnExport') && !e.target.closest('#exportMenu')) $('#exportMenu')?.classList.add('hidden'); });
    $('#expXlsx').addEventListener('click', () => exportXlsx(viewToExport()));
    $('#expCsv').addEventListener('click', () => exportCsv(viewToExport()));
    $('#expPrint').addEventListener('click', () => exportPrint(viewToExport()));
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); can('export') && exportXlsx(viewToExport()); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); toast('All changes already auto-saved to the sheet', 'info'); }
  });

  renderTable();
}

function viewToExport() { return searchApply(filteredRows); }

function searchApply(rows) {
  if (!searchTerm) return rows;
  return rows.filter((r) => COLUMNS.some((c) => (r[c.key] ?? '').toString().toLowerCase().includes(searchTerm)));
}

function sortRows(rows) {
  const col = COLUMNS.find((c) => c.key === sortKey);
  return [...rows].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'date') { av = new Date(a.date?.split('.').reverse().join('-') || a.date); bv = new Date(b.date?.split('.').reverse().join('-') || b.date); }
    else if (col?.num) { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = (av ?? '').toString().toLowerCase(); bv = (bv ?? '').toString().toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const searched = searchApply(filteredRows);
  viewRows = sortRows(searched);
  const total = viewRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, totalPages);
  const start = (page - 1) * pageSize;
  const pageRows = viewRows.slice(start, start + pageSize);

  $('#resultCount').textContent = `${formatNumber(total)} record${total === 1 ? '' : 's'}`;

  renderHead();
  renderBody(pageRows);
  renderPagination(total, totalPages);
  renderBulkBar();
}

function visibleColumns() { return COLUMNS.filter((c) => colVisibility[c.key] !== false); }

function renderHead() {
  const tr = $('#dataTable thead tr');
  tr.innerHTML = `<th style="width:34px;"><input type="checkbox" id="selectAll" /></th>` +
    visibleColumns().map((c) => `<th data-key="${c.key}" class="${sortKey === c.key ? 'sorted ' + sortDir : ''}">${c.label}</th>`).join('') +
    `<th>Actions</th>`;
  $('#selectAll').checked = selectedIds.size > 0 && viewRows.every((r) => selectedIds.has(r.id));
  $('#selectAll').addEventListener('change', (e) => {
    viewRows.forEach((r) => { if (e.target.checked) selectedIds.add(r.id); else selectedIds.delete(r.id); });
    renderTable();
  });
  $$('th[data-key]', tr).forEach((th) => th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'; else { sortKey = key; sortDir = 'asc'; }
    renderTable();
  }));
}

function renderBody(rows) {
  const tbody = $('#dataTable tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${visibleColumns().length + 2}" style="text-align:center;padding:40px;color:var(--text-mute);">No matching transactions. Try adjusting filters or search.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r) => `
    <tr data-id="${r.id}">
      <td><input type="checkbox" class="rowSel" ${selectedIds.has(r.id) ? 'checked' : ''} /></td>
      ${visibleColumns().map((c) => `<td>${cellValue(r, c)}</td>`).join('')}
      <td class="row-actions">
        <button class="btn-icon" data-act="dup" title="Duplicate">⎘</button>
        ${can('edit') ? `<button class="btn-icon" data-act="edit" title="Edit">✎</button>` : ''}
        ${can('delete') ? `<button class="btn-icon" data-act="del" title="Delete">🗑</button>` : ''}
        <button class="btn-icon" data-act="print" title="Print">🖨</button>
      </td>
    </tr>`).join('');

  $$('.rowSel', tbody).forEach((cb) => cb.addEventListener('change', (e) => {
    const id = e.target.closest('tr').dataset.id;
    if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
    renderBulkBar();
    $('#selectAll').checked = viewRows.every((r) => selectedIds.has(r.id));
  }));
  $$('button[data-act]', tbody).forEach((btn) => btn.addEventListener('click', (e) => {
    const id = e.target.closest('tr').dataset.id;
    const row = allRows.find((r) => r.id === id);
    const act = btn.dataset.act;
    if (act === 'edit') openEntryModal(row);
    if (act === 'del') deleteRow(row);
    if (act === 'dup') openEntryModal({ ...row, id: null, invoice: row.invoice + '-COPY' });
    if (act === 'print') exportPrint([row]);
  }));
}

function cellValue(r, c) {
  if (c.key === 'date') return formatDate(r.date);
  if (c.key === 'status') return `<span class="badge status-${r.status}">${r.status}</span>`;
  if (c.key === 'margin') { const m = calcMargin(r.purchase, r.selling); return `<span class="${m >= 0 ? 'margin-pos' : 'margin-neg'}">${formatCurrency(m)}</span>`; }
  if (c.key === 'purchase' || c.key === 'selling') return r[c.key] === '' || r[c.key] == null ? '<span class="text-mute">—</span>' : formatCurrency(r[c.key]);
  if (c.key === 'qty') return formatNumber(r.qty);
  return r[c.key] ?? '—';
}

function renderPagination(total, totalPages) {
  const el = $('#pagination');
  const sizes = [25, 50, 100, 250];
  el.innerHTML = `
    <div class="flex items-center gap-2">
      <span>Rows per page</span>
      <select id="pageSizeSel" style="border:1px solid var(--border);border-radius:8px;padding:5px 8px;background:var(--card);color:var(--text);">
        ${sizes.map((s) => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <span>· Page ${page} of ${totalPages}</span>
    </div>
    <div class="pages">
      <button id="pgFirst" ${page === 1 ? 'disabled' : ''}>«</button>
      <button id="pgPrev" ${page === 1 ? 'disabled' : ''}>‹</button>
      <button id="pgNext" ${page === totalPages ? 'disabled' : ''}>›</button>
      <button id="pgLast" ${page === totalPages ? 'disabled' : ''}>»</button>
    </div>`;
  $('#pageSizeSel').addEventListener('change', (e) => { pageSize = Number(e.target.value); localStorage.setItem(PAGE_SIZE_KEY, pageSize); page = 1; renderTable(); });
  $('#pgFirst').addEventListener('click', () => { page = 1; renderTable(); });
  $('#pgPrev').addEventListener('click', () => { page = Math.max(1, page - 1); renderTable(); });
  $('#pgNext').addEventListener('click', () => { page = Math.min(totalPages, page + 1); renderTable(); });
  $('#pgLast').addEventListener('click', () => { page = totalPages; renderTable(); });
}

function renderBulkBar() {
  const bar = $('#bulkBar');
  if (!selectedIds.size) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = `
    <span class="chip">${selectedIds.size} selected</span>
    ${can('export') ? `<button class="btn btn-ghost btn-sm" id="bulkExport">Export</button>` : ''}
    ${can('edit') ? `<button class="btn btn-ghost btn-sm" id="bulkStatus">Set Status</button>
    <button class="btn btn-ghost btn-sm" id="bulkWarehouse">Set Warehouse</button>` : ''}
    ${can('delete') ? `<button class="btn btn-danger btn-sm" id="bulkDelete">Delete</button>` : ''}
  `;
  $('#bulkExport')?.addEventListener('click', () => exportXlsx(allRows.filter((r) => selectedIds.has(r.id))));
  $('#bulkStatus')?.addEventListener('click', async () => {
    const v = prompt('Set status to (Delivered / Pending / Dispatched / Cancelled):', 'Delivered');
    if (!v) return;
    await bulkUpdate([...selectedIds], { status: v });
    allRows.forEach((r) => { if (selectedIds.has(r.id)) r.status = v; });
    toast(`Updated status for ${selectedIds.size} rows`, 'success');
    renderTable();
  });
  $('#bulkWarehouse')?.addEventListener('click', async () => {
    const v = prompt('Set warehouse to:');
    if (!v) return;
    await bulkUpdate([...selectedIds], { warehouse: v });
    allRows.forEach((r) => { if (selectedIds.has(r.id)) r.warehouse = v; });
    toast(`Updated warehouse for ${selectedIds.size} rows`, 'success');
    renderTable();
  });
  $('#bulkDelete')?.addEventListener('click', async () => {
    const ok = await confirmDialog(`Delete ${selectedIds.size} selected rows? This cannot be undone from here.`, { danger: true });
    if (!ok) return;
    await bulkDelete([...selectedIds]);
    allRows = allRows.filter((r) => !selectedIds.has(r.id));
    filteredRows = filteredRows.filter((r) => !selectedIds.has(r.id));
    selectedIds.clear();
    toast('Selected rows deleted', 'success');
    renderTable();
  });
}

function openColumnMenu(anchor) {
  document.querySelectorAll('.colmenu').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'colmenu';
  menu.style.cssText = 'position:absolute;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);padding:10px;z-index:50;max-height:280px;overflow-y:auto;';
  const rect = anchor.getBoundingClientRect();
  menu.style.top = rect.bottom + window.scrollY + 6 + 'px';
  menu.style.left = rect.left + window.scrollX + 'px';
  menu.innerHTML = COLUMNS.map((c) => `
    <label style="display:flex;gap:8px;align-items:center;padding:4px 2px;font-size:12.5px;">
      <input type="checkbox" data-key="${c.key}" ${colVisibility[c.key] === false ? '' : 'checked'} /> ${c.label}
    </label>`).join('');
  document.body.appendChild(menu);
  menu.querySelectorAll('input').forEach((cb) => cb.addEventListener('change', (e) => {
    colVisibility[e.target.dataset.key] = e.target.checked;
    localStorage.setItem(COLVIS_KEY, JSON.stringify(colVisibility));
    renderTable();
  }));
  setTimeout(() => document.addEventListener('click', function close(e) { if (!menu.contains(e.target) && e.target !== anchor) { menu.remove(); document.removeEventListener('click', close); } }), 10);
}

// ---------------- Add / Edit modal ----------------
function openEntryModal(existing = null) {
  const isEdit = !!existing?.id;
  const editableRestricted = existing && can('editOwnOnly') && !can('edit');
  const row = existing || { date: new Date().toISOString().slice(0,10), status: 'Pending' };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>${isEdit ? 'Edit Entry' : 'Add Entry'}</h3><button class="btn-icon" id="closeModal">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          ${field('date', 'Date', 'date', row.date)}
          ${field('invoice', 'Invoice No.', 'text', row.invoice, true)}
          ${field('sellingParty', 'Selling Party', 'text', row.sellingParty, true)}
          ${field('transport', 'Transport', 'text', row.transport)}
          ${field('item', 'Item Name', 'text', row.item, true)}
          ${field('packing', 'Packing', 'text', row.packing)}
          ${field('qty', 'Quantity', 'number', row.qty, true)}
          ${field('purchasedParty', 'Purchased Party', 'text', row.purchasedParty)}
          ${field('warehouse', 'Warehouse', 'text', row.warehouse)}
          ${field('purchase', 'Purchase Price', 'number', row.purchase)}
          ${field('selling', 'Selling Price', 'number', row.selling)}
          ${field('salesPerson', 'Sales Person', 'text', row.salesPerson)}
          <div class="field">
            <label>Status</label>
            <select id="in_status">
              ${['Pending','Dispatched','Delivered','Cancelled'].map((s) => `<option ${row.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label>Remarks</label>
            <input type="text" id="in_remarks" value="${row.remarks || ''}" />
          </div>
          <div class="field full" style="background:var(--bg-alt);border-radius:10px;padding:10px 14px;">
            <span class="text-mute" style="font-size:12.5px;">Auto margin (Selling − Purchase): </span>
            <b id="liveMargin" style="font-family:var(--font-mono);">₹0</b>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="cancelModal">Cancel</button>
        <button class="btn btn-primary" id="saveModal">${isEdit ? 'Update Entry' : 'Save Entry'}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  $('#closeModal', backdrop).addEventListener('click', close);
  $('#cancelModal', backdrop).addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  const updateMargin = () => {
    const p = Number($('#in_purchase', backdrop).value) || 0;
    const s = Number($('#in_selling', backdrop).value) || 0;
    $('#liveMargin', backdrop).textContent = formatCurrency(s - p);
  };
  ['in_purchase', 'in_selling'].forEach((id) => $('#' + id, backdrop).addEventListener('input', updateMargin));
  updateMargin();

  $('#saveModal', backdrop).addEventListener('click', async () => {
    const data = {
      date: $('#in_date', backdrop).value,
      invoice: $('#in_invoice', backdrop).value.trim(),
      sellingParty: $('#in_sellingParty', backdrop).value.trim(),
      transport: $('#in_transport', backdrop).value.trim(),
      item: $('#in_item', backdrop).value.trim(),
      packing: $('#in_packing', backdrop).value.trim(),
      qty: Number($('#in_qty', backdrop).value) || 0,
      purchasedParty: $('#in_purchasedParty', backdrop).value.trim(),
      warehouse: $('#in_warehouse', backdrop).value.trim(),
      purchase: $('#in_purchase', backdrop).value,
      selling: $('#in_selling', backdrop).value,
      salesPerson: $('#in_salesPerson', backdrop).value.trim(),
      status: $('#in_status', backdrop).value,
      remarks: $('#in_remarks', backdrop).value.trim(),
    };
    const required = ['date', 'invoice', 'sellingParty', 'item', 'qty'];
    const missing = required.filter((k) => !data[k]);
    if (missing.length) { toast(`Please fill required fields: ${missing.join(', ')}`, 'error'); return; }

    try {
      if (isEdit) {
        await updateData(row.id, data);
        Object.assign(row, data);
        toast('Entry updated', 'success');
      } else {
        const saved = await insertData(data);
        allRows.unshift({ ...saved, margin: calcMargin(saved.purchase, saved.selling) });
        filteredRows = [allRows[0], ...filteredRows];
        toast('Entry saved', 'success');
      }
      close();
      renderTable();
    } catch (e) {
      toast(e.message || 'Could not save entry', 'error');
    }
  });
}

function field(id, label, type, value, required = false) {
  return `
    <div class="field">
      <label>${label}${required ? ' *' : ''}</label>
      <input id="in_${id}" type="${type}" value="${value ?? ''}" ${required ? 'required' : ''} />
    </div>`;
}

async function deleteRow(row) {
  const ok = await confirmDialog(`Delete invoice ${row.invoice} — ${row.item}?`, { danger: true });
  if (!ok) return;
  try {
    await deleteData(row.id);
    allRows = allRows.filter((r) => r.id !== row.id);
    filteredRows = filteredRows.filter((r) => r.id !== row.id);
    renderTable();
    let undone = false;
    toast(`Entry deleted — <button id="undoDel" style="text-decoration:underline;background:none;border:none;color:inherit;cursor:pointer;">Undo</button>`, 'warning', 5000);
    setTimeout(() => {
      const btn = document.getElementById('undoDel');
      btn?.addEventListener('click', async () => {
        if (undone) return; undone = true;
        await restoreRow(row);
        allRows.unshift(row); filteredRows.unshift(row);
        renderTable();
        toast('Entry restored', 'success');
      });
    }, 30);
  } catch (e) { toast(e.message || 'Could not delete', 'error'); }
}

// ---------------- Export ----------------
function exportRows(rows) {
  return rows.map((r) => ({
    Date: formatDate(r.date), Invoice: r.invoice, 'Selling Party': r.sellingParty, Transport: r.transport,
    Item: r.item, Packing: r.packing, Qty: r.qty, 'Purchased Party': r.purchasedParty, Warehouse: r.warehouse,
    Purchase: r.purchase, Selling: r.selling, Margin: calcMargin(r.purchase, r.selling),
    'Sales Person': r.salesPerson, Status: r.status, Remarks: r.remarks,
  }));
}

function exportCsv(rows) {
  const data = exportRows(rows);
  if (!data.length) return toast('No rows to export', 'warning');
  const headers = Object.keys(data[0]);
  const lines = [headers.join(','), ...data.map((row) => headers.map((h) => csvEscape(row[h])).join(','))];
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), todayFilename('Sales_Report', 'csv'));
  toast('CSV export complete', 'success');
}

function exportXlsx(rows) {
  const data = exportRows(rows);
  if (!data.length) return toast('No rows to export', 'warning');
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded — using CSV instead', 'warning'); return exportCsv(rows); }
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0]).map((k) => ({ wch: Math.max(10, k.length + 4) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
  XLSX.writeFile(wb, todayFilename('Sales_Report', 'xlsx'));
  toast('Excel export complete', 'success');
}

function exportPrint(rows) {
  const data = exportRows(rows);
  const w = window.open('', '_blank');
  const headers = data.length ? Object.keys(data[0]) : [];
  w.document.write(`
    <html><head><title>Sales Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;} th{background:#1E3A8A;color:#fff;}</style>
    </head><body>
    <h2>Sales Dispatch Report — ${new Date().toLocaleDateString()}</h2>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${data.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
