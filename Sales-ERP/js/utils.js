// ============================================================
// utils.js — shared helper functions (no dependencies)
// ============================================================

export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatCurrency(n, currency = getSetting('currency', '₹')) {
  const num = Number(n) || 0;
  return `${currency}${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('en-IN');
}

export function formatDate(d, fmt = getSetting('dateFormat', 'DD-MM-YYYY')) {
  if (!d) return '—';
  const date = (d instanceof Date) ? d : parseAnyDate(d);
  if (!date || isNaN(date)) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (fmt === 'MM-DD-YYYY') return `${mm}-${dd}-${yyyy}`;
  if (fmt === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  return `${dd}-${mm}-${yyyy}`;
}

export function parseAnyDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    // supports DD.MM.YY, DD-MM-YYYY, YYYY-MM-DD
    let m = v.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
      return new Date(Number(y), Number(mo) - 1, Number(d));
    }
    const d2 = new Date(v);
    if (!isNaN(d2)) return d2;
  }
  return null;
}

export function toast(msg, type = 'info', ms = 3200) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || icons.info}</span><span>${msg}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 250); }, ms);
}

export function confirmDialog(message, { danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-head"><h3>Please confirm</h3></div>
        <div class="modal-body"><p style="font-size:14px;color:var(--text-mute);">${message}</p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-act="no">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${danger ? 'Delete' : 'Confirm'}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.dataset.act === 'no') { backdrop.remove(); resolve(false); }
      if (e.target.dataset.act === 'yes') { backdrop.remove(); resolve(true); }
    });
  });
}

export function getSetting(key, fallback) {
  try {
    const s = JSON.parse(localStorage.getItem('erp_settings') || '{}');
    return s[key] ?? fallback;
  } catch { return fallback; }
}

export function setSetting(key, value) {
  const s = JSON.parse(localStorage.getItem('erp_settings') || '{}');
  s[key] = value;
  localStorage.setItem('erp_settings', JSON.stringify(s));
}

export function applyTheme() {
  const dark = getSetting('darkMode', false);
  document.documentElement.classList.toggle('dark', dark);
  return dark;
}

export function calcMargin(purchase, selling) {
  const p = Number(purchase) || 0, s = Number(selling) || 0;
  return +(s - p).toFixed(2);
}

export function marginPct(purchase, selling) {
  const p = Number(purchase) || 0, s = Number(selling) || 0;
  if (!p) return 0;
  return +(((s - p) / p) * 100).toFixed(1);
}

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function todayFilename(prefix, ext) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${prefix}_${dd}_${mm}_${yyyy}.${ext}`;
}
