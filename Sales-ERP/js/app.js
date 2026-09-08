// ============================================================
// app.js — shared shell (sidebar + topbar) for every inner page
// ============================================================
import { requireAuth, logout, can, initials } from './auth.js';
import { applyTheme, setSetting, getSetting, $ } from './utils.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'grid' },
  { id: 'transactions', label: 'Transactions', href: 'transactions.html', icon: 'list' },
  { id: 'warehouse', label: 'Warehouse', href: 'warehouse.html', icon: 'box' },
  { id: 'reports', label: 'Reports', href: 'reports.html', icon: 'chart' },
  { id: 'settings', label: 'Settings', href: 'settings.html', icon: 'gear' },
];

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1.4"/><circle cx="3" cy="12" r="1.4"/><circle cx="3" cy="18" r="1.4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  chart: '<path d="M4 20V10M12 20V4M20 20v-6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function mountShell(activeId, pageTitle) {
  const session = requireAuth();
  if (!session) return null;
  applyTheme();

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><span class="dot"></span><span>Sales Dispatch ERP</span></div>
        <nav>
          ${NAV.map((n) => `
            <a class="nav-item ${n.id === activeId ? 'active' : ''}" href="${n.href}">
              ${icon(n.icon)}<span>${n.label}</span>
            </a>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <a class="nav-item" href="#" id="logoutBtn">${icon('logout')}<span>Logout</span></a>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="btn-icon" id="menuToggle">${icon('menu', 16)}</button>
            <h1>${pageTitle}</h1>
          </div>
          <div class="topbar-right">
            <div class="search-mini">
              ${icon('list', 14)}
              <input type="text" id="globalSearch" placeholder="Search invoice, party, item… (Ctrl+F)" />
            </div>
            <button class="btn-icon" id="themeToggle" title="Toggle dark mode"></button>
            <div class="avatar" title="${session.name} (${session.role})">${initials(session.name)}</div>
          </div>
        </header>
        <main class="content" id="pageContent"></main>
      </div>
    </div>
  `);

  const themeBtn = $('#themeToggle');
  const setThemeIcon = () => { themeBtn.innerHTML = icon(document.documentElement.classList.contains('dark') ? 'sun' : 'moon', 16); };
  setThemeIcon();
  themeBtn.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    setSetting('darkMode', next);
    setThemeIcon();
  });

  $('#logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });

  $('#menuToggle').addEventListener('click', () => {
    const sb = $('#sidebar');
    if (window.innerWidth <= 880) sb.classList.toggle('mobile-open');
    else sb.classList.toggle('collapsed');
  });

  $('#globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      sessionStorage.setItem('erp_pending_search', e.target.value.trim());
      window.location.href = 'transactions.html';
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      if (activeId === 'transactions') { e.preventDefault(); $('#globalSearch')?.focus(); }
    }
  });

  return { session, contentEl: $('#pageContent') };
}

export function permissionGate(perm, el) {
  if (!can(perm)) el.remove();
}
