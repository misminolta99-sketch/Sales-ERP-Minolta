// ============================================================
// dashboard.js
// ============================================================
import { mountShell } from './app.js';
import { getData } from './api.js';
import { formatCurrency, formatNumber, formatDate, parseAnyDate, calcMargin, $ } from './utils.js';
import { lineChart, barChart, doughnutChart } from './charts.js';

const shell = mountShell('dashboard', 'Dashboard');
if (shell) init();

async function init() {
  const { contentEl } = shell;
  contentEl.innerHTML = skeletonLayout();

  let rows = [];
  try { rows = await getData(); }
  catch (e) { contentEl.innerHTML = `<div class="card card-body">Could not load data: ${e.message}</div>`; return; }

  const today = new Date(); today.setHours(0,0,0,0);
  const enriched = rows.map((r) => ({ ...r, _date: parseAnyDate(r.date), _margin: calcMargin(r.purchase, r.selling) }));

  const todays = enriched.filter((r) => r._date && sameDay(r._date, today));
  const monthKey = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : null;
  const thisMonthKey = monthKey(today);
  const monthRows = enriched.filter((r) => monthKey(r._date) === thisMonthKey);

  const totalInvoices = new Set(enriched.map((r) => r.invoice)).size;
  const pending = enriched.filter((r) => r.status === 'Pending').length;
  const delivered = enriched.filter((r) => r.status === 'Delivered').length;
  const warehouseQty = enriched.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const avgMargin = enriched.length ? (enriched.reduce((s, r) => s + r._margin, 0) / enriched.length) : 0;
  const monthlySales = monthRows.reduce((s, r) => s + (Number(r.selling) || 0) * 0, 0); // selling is per-unit price in source sheet
  const todaysSalesValue = todays.reduce((s, r) => s + ((Number(r.selling) || 0)), 0);
  const todaysQty = todays.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  contentEl.innerHTML = `
    <div class="kpi-grid">
      ${kpi('Today\'s Sales', formatCurrency(todaysSalesValue), 'secondary')}
      ${kpi('Today\'s Quantity', formatNumber(todaysQty) + ' kg', 'accent')}
      ${kpi('Total Invoices', formatNumber(totalInvoices), 'primary')}
      ${kpi('Pending Orders', formatNumber(pending), 'warning')}
      ${kpi('Delivered Orders', formatNumber(delivered), 'success')}
      ${kpi('Warehouse Stock', formatNumber(warehouseQty) + ' kg', 'secondary')}
      ${kpi('Average Margin', formatCurrency(avgMargin.toFixed(0)), 'accent')}
      ${kpi('Monthly Entries', formatNumber(monthRows.length), 'primary')}
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-head"><h3>Sales by Month</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chMonth"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Warehouse Wise Dispatch (Qty)</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chWarehouse"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Party Wise Sales</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chParty"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Top Selling Products</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chProducts"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Transport Wise Dispatch</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chTransport"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Status Split</h3></div>
        <div class="card-body" style="height:260px;"><canvas id="chStatus"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Recent Transactions</h3><a class="btn btn-ghost btn-sm" href="transactions.html">View all</a></div>
      <div class="table-wrap" style="max-height:340px;">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Invoice</th><th>Selling Party</th><th>Item</th><th>Warehouse</th><th>Qty</th><th>Status</th></tr></thead>
          <tbody>
            ${enriched.slice(0, 8).map((r) => `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td><b>${r.invoice}</b></td>
                <td>${r.sellingParty}</td>
                <td>${r.item}</td>
                <td>${r.warehouse || '—'}</td>
                <td>${formatNumber(r.qty)}</td>
                <td><span class="badge status-${r.status}">${r.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderCharts(enriched);
}

function renderCharts(rows) {
  // Sales by month (count of entries as proxy for dispatch volume)
  const byMonth = groupSum(rows, (r) => r._date ? `${r._date.toLocaleString('en', {month:'short'})} ${r._date.getFullYear()}` : 'Unknown', () => 1);
  lineChart('chMonth', Object.keys(byMonth), [{ label: 'Dispatches', data: Object.values(byMonth) }]);

  const byWarehouse = groupSum(rows, (r) => r.warehouse || 'Unassigned', (r) => Number(r.qty) || 0);
  const wh = topN(byWarehouse, 6);
  barChart('chWarehouse', wh.map((x) => x[0]), [{ label: 'Qty (kg)', data: wh.map((x) => x[1]) }]);

  const byParty = groupSum(rows, (r) => r.sellingParty || 'Unknown', (r) => Number(r.selling) || 0);
  const parties = topN(byParty, 6);
  barChart('chParty', parties.map((x) => shorten(x[0])), [{ label: 'Sales value', data: parties.map((x) => x[1]) }], true);

  const byProduct = groupSum(rows, (r) => r.item || 'Unknown', (r) => Number(r.qty) || 0);
  const products = topN(byProduct, 6);
  doughnutChart('chProducts', products.map((x) => shorten(x[0], 16)), products.map((x) => x[1]));

  const byTransport = groupSum(rows, (r) => r.transport || 'Unknown', () => 1);
  const transport = topN(byTransport, 6);
  barChart('chTransport', transport.map((x) => shorten(x[0])), [{ label: 'Dispatches', data: transport.map((x) => x[1]) }]);

  const byStatus = groupSum(rows, (r) => r.status || 'Unknown', () => 1);
  doughnutChart('chStatus', Object.keys(byStatus), Object.values(byStatus));
}

function groupSum(rows, keyFn, valFn) {
  const map = {};
  rows.forEach((r) => { const k = keyFn(r); map[k] = (map[k] || 0) + valFn(r); });
  return map;
}
function topN(obj, n) { return Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, n); }
function shorten(s, n = 14) { return s.length > n ? s.slice(0, n) + '…' : s; }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function kpi(label, value, tone) {
  const tones = { primary: 'var(--primary)', secondary: 'var(--secondary)', accent: 'var(--accent)', warning: 'var(--warning)', success: 'var(--success)' };
  const c = tones[tone] || tones.secondary;
  return `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${label}</span>
        <span class="kpi-icon" style="background:${c}1f;color:${c};">●</span>
      </div>
      <div class="kpi-value">${value}</div>
    </div>`;
}

function skeletonLayout() {
  return `<div class="kpi-grid">${Array(8).fill('<div class="skeleton" style="height:92px;"></div>').join('')}</div>
  <div class="charts-grid">${Array(4).fill('<div class="skeleton" style="height:260px;"></div>').join('')}</div>`;
}
