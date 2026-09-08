// ============================================================
// auth.js — login, session, role-based permissions
//
// DEMO credentials (any password works in demo mode — this is a
// front-end-only sandbox until you connect Code.gs, which should
// verify real credentials server-side; see README "Security").
// ============================================================

const USERS = [
  { username: 'admin', name: 'Admin User', role: 'Admin' },
  { username: 'sales', name: 'Sales Executive', role: 'Sales' },
  { username: 'viewer', name: 'Viewer', role: 'Viewer' },
];

export const PERMISSIONS = {
  Admin: { insert: true, edit: true, editOwnOnly: false, delete: true, export: true, manageUsers: true },
  Sales: { insert: true, edit: true, editOwnOnly: true, delete: false, export: true, manageUsers: false },
  Viewer: { insert: false, edit: false, editOwnOnly: false, delete: false, export: false, manageUsers: false },
};

export function login(username, role) {
  const user = USERS.find((u) => u.username === username.trim().toLowerCase()) || {
    username: username.trim().toLowerCase(), name: username, role,
  };
  const session = { ...user, role, token: 'demo_' + Math.random().toString(36).slice(2), loginAt: Date.now() };
  sessionStorage.setItem('erp_session', JSON.stringify(session));
  sessionStorage.setItem('erp_token', session.token);
  return session;
}

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem('erp_session')); } catch { return null; }
}

export function logout() {
  sessionStorage.removeItem('erp_session');
  sessionStorage.removeItem('erp_token');
  window.location.href = 'index.html';
}

export function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  return s;
}

export function can(permission) {
  const s = getSession();
  if (!s) return false;
  return !!PERMISSIONS[s.role]?.[permission];
}

export function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
