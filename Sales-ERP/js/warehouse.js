import { mountShell } from './app.js';
import { getData } from './api.js';
import { formatNumber, formatCurrency, parseAnyDate, debounce, $ } from './utils.js';

const shell = mountShell('warehouse', 'Warehouse');
if (shell) init();

async function init() {
  const { contentEl } = shell;
  contentEl.innerHTML = `<div class="skeleton" style="height:400px;"></div>`;
  const rows = await getData();
  const today = new Date(); today.setHours(0,0,0,0);

  const byWH = {};
  rows.forEach((r) => {
    const wh = r.warehouse || 'Unassigned';
    byWH[wh] ??= { qty: 0, products: new Set(), todayDispatch: 0, pending: 0, revenue: 0, count: 0 };
    const b = byWH[wh];
    b.qty += Number(r.qty) || 0;
    b.products.add(r.item);
    b.revenue += Number(r.selling) || 0;
    b.count += 1;
    if (r.status === 'Pending') b.pending += 1;
    const d = parseAnyDate(r.date);
    if (d && d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate()) b.todayDispatch += Number(r.qty)||0;
  });

  const totalQty = rows.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const totalProducts = new Set(rows.map((r)=>r.item)).size;
  const totalToday = Object.values(byWH).reduce((s,b)=>s+b.todayDispatch,0);
  const totalPending = Object.values(byWH).reduce((s,b)=>s+b.pending,0);

  contentEl.innerHTML = `
    <div class="kpi-grid">
      ${kpi('Total Quantity', formatNumber(totalQty) + ' kg')}
      ${kpi('Products', formatNumber(totalProducts))}
      ${kpi("Today's Dispatch", formatNumber(totalToday) + ' kg')}
      ${kpi('Pending Dispatch', formatNumber(totalPending))}
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Warehouse Directory</h3>
        <div class="search-mini" style="width:220px;">🔎<input id="whSearch" type="text" placeholder="Search warehouse…" /></div>
      </div>
      <div class="table-wrap" style="max-height:60vh;">
        <table class="data-table">
          <thead><tr><th>Warehouse</th><th>Entries</th><th>Total Qty</th><th>Products</th><th>Today's Dispatch</th><th>Pending</th><th>Revenue</th></tr></thead>
          <tbody id="whBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const draw = (term = '') => {
    const body = $('#whBody');
    const entries = Object.entries(byWH).filter(([name]) => name.toLowerCase().includes(term.toLowerCase()))
      .sort((a,b) => b[1].qty - a[1].qty);
    body.innerHTML = entries.map(([name, b]) => `
      <tr>
        <td><b>${name}</b></td>
        <td>${formatNumber(b.count)}</td>
        <td>${formatNumber(b.qty)} kg</td>
        <td>${b.products.size}</td>
        <td>${formatNumber(b.todayDispatch)} kg</td>
        <td>${b.pending ? `<span class="badge status-Pending">${b.pending}</span>` : '—'}</td>
        <td>${formatCurrency(b.revenue)}</td>
      </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-mute);">No warehouses match.</td></tr>`;
  };
  draw();
  $('#whSearch').addEventListener('input', debounce((e) => draw(e.target.value), 200));
}

function kpi(label, value) {
  return `<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">${label}</span></div><div class="kpi-value">${value}</div></div>`;
}
