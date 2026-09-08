import { mountShell } from './app.js';
import { getData } from './api.js';
import { formatCurrency, formatNumber, calcMargin, parseAnyDate, downloadBlob, csvEscape, todayFilename, $ } from './utils.js';
import { barChart } from './charts.js';

const shell = mountShell('reports', 'Reports');
if (shell) init();

const REPORT_TYPES = [
  { id: 'party', label: 'Party Wise', group: (r) => r.sellingParty || 'Unknown' },
  { id: 'warehouse', label: 'Warehouse Wise', group: (r) => r.warehouse || 'Unassigned' },
  { id: 'product', label: 'Product Wise', group: (r) => r.item || 'Unknown' },
  { id: 'transport', label: 'Transport Wise', group: (r) => r.transport || 'Unknown' },
  { id: 'salesperson', label: 'Sales Person Wise', group: (r) => r.salesPerson || 'Unassigned' },
  { id: 'monthly', label: 'Monthly', group: (r) => { const d = parseAnyDate(r.date); return d ? `${d.toLocaleString('en',{month:'short'})} ${d.getFullYear()}` : 'Unknown'; } },
  { id: 'yearly', label: 'Yearly', group: (r) => { const d = parseAnyDate(r.date); return d ? String(d.getFullYear()) : 'Unknown'; } },
  { id: 'margin', label: 'Margin Report', group: (r) => r.sellingParty || 'Unknown' },
  { id: 'topcustomers', label: 'Top Customers', group: (r) => r.sellingParty || 'Unknown' },
  { id: 'slowmoving', label: 'Slow Moving Items', group: (r) => r.item || 'Unknown' },
];

let rows = [];

async function init() {
  const { contentEl } = shell;
  contentEl.innerHTML = `<div class="skeleton" style="height:400px;"></div>`;
  rows = (await getData()).map((r) => ({ ...r, margin: calcMargin(r.purchase, r.selling) }));

  contentEl.innerHTML = `
    <div class="filter-bar" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div class="field" style="margin:0;min-width:220px;">
        <label>Report Type</label>
        <select id="reportType">${REPORT_TYPES.map((r) => `<option value="${r.id}">${r.label}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary btn-sm" id="btnGenerate" style="margin-top:20px;">Generate Report</button>
      <button class="btn btn-ghost btn-sm" id="btnDownload" style="margin-top:20px;">Download CSV</button>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-head"><h3 id="reportTitle">Party Wise Report</h3></div>
      <div class="card-body" style="height:280px;"><canvas id="reportChart"></canvas></div>
    </div>
    <div class="card">
      <div class="table-wrap" style="max-height:50vh;">
        <table class="data-table" id="reportTable"><thead></thead><tbody></tbody></table>
      </div>
    </div>
  `;

  $('#btnGenerate').addEventListener('click', generate);
  $('#btnDownload').addEventListener('click', downloadCurrent);
  generate();
}

let lastRows = [];

function generate() {
  const typeId = $('#reportType').value;
  const type = REPORT_TYPES.find((t) => t.id === typeId);
  $('#reportTitle').textContent = type.label + ' Report';

  const map = {};
  rows.forEach((r) => {
    const key = type.group(r);
    map[key] ??= { count: 0, qty: 0, revenue: 0, cost: 0, margin: 0 };
    map[key].count += 1;
    map[key].qty += Number(r.qty) || 0;
    map[key].revenue += Number(r.selling) || 0;
    map[key].cost += Number(r.purchase) || 0;
    map[key].margin += r.margin;
  });

  let entries = Object.entries(map).map(([name, v]) => ({ name, ...v }));

  if (type.id === 'topcustomers') entries.sort((a, b) => b.revenue - a.revenue);
  else if (type.id === 'slowmoving') entries.sort((a, b) => a.qty - b.qty);
  else if (type.id === 'margin') entries.sort((a, b) => b.margin - a.margin);
  else entries.sort((a, b) => b.revenue - a.revenue);

  entries = entries.slice(0, 25);
  lastRows = entries;

  const tbl = $('#reportTable');
  tbl.querySelector('thead').innerHTML = `<tr><th>${type.label.split(' ')[0] === 'Monthly' || type.label==='Yearly' ? 'Period' : 'Name'}</th><th>Entries</th><th>Qty</th><th>Revenue</th><th>Cost</th><th>Margin</th></tr>`;
  tbl.querySelector('tbody').innerHTML = entries.map((e) => `
    <tr><td><b>${e.name}</b></td><td>${formatNumber(e.count)}</td><td>${formatNumber(e.qty)}</td>
    <td>${formatCurrency(e.revenue)}</td><td>${formatCurrency(e.cost)}</td>
    <td class="${e.margin>=0?'margin-pos':'margin-neg'}">${formatCurrency(e.margin)}</td></tr>`).join('')
    || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-mute);">No data available.</td></tr>`;

  const top = entries.slice(0, 8);
  barChart('reportChart', top.map((e) => e.name.length>16?e.name.slice(0,16)+'…':e.name), [{ label: 'Revenue', data: top.map((e) => e.revenue) }], true);
}

function downloadCurrent() {
  if (!lastRows.length) return;
  const headers = ['Name','Entries','Qty','Revenue','Cost','Margin'];
  const lines = [headers.join(','), ...lastRows.map((e) => [e.name,e.count,e.qty,e.revenue,e.cost,e.margin].map(csvEscape).join(','))];
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), todayFilename('Report', 'csv'));
}
