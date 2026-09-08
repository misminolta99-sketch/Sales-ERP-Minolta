// ============================================================
// api.js — data access layer
//
// Two modes, chosen automatically:
//   1. LIVE   — API_URL below points at your deployed Apps Script
//               web app. All calls go through fetch() as JSON.
//   2. DEMO   — API_URL is empty/unreachable. Falls back to a
//               localStorage-backed store seeded from seed-data.js
//               so the whole app is fully clickable on Netlify
//               with zero setup. Swap in your URL to go live —
//               nothing else in the app needs to change, because
//               both modes implement the exact same functions.
//
// Deploy google-apps-script/Code.gs as a Web App ("Execute as: me",
// "Who has access: Anyone"), then paste the /exec URL below.
// ============================================================

import { SEED_ROWS } from './seed-data.js';
import { uid, calcMargin } from './utils.js';

export const API_URL = ''; // <-- paste your Apps Script /exec URL here to go live
export const DEMO_MODE = !API_URL;

const STORE_KEY = 'erp_demo_rows_v1';

function loadStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) return JSON.parse(raw);
  localStorage.setItem(STORE_KEY, JSON.stringify(SEED_ROWS));
  return JSON.parse(JSON.stringify(SEED_ROWS));
}
function saveStore(rows) {
  localStorage.setItem(STORE_KEY, JSON.stringify(rows));
}
function delay(ms = 220) { return new Promise((res) => setTimeout(res, ms)); }

// ---------- LIVE transport ----------
async function callGAS(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids GAS CORS preflight
    body: JSON.stringify({ action, token: sessionStorage.getItem('erp_token') || '', ...payload }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}

// ============================================================
// Public API — identical surface in both modes
// ============================================================

export async function getData() {
  if (!DEMO_MODE) return callGAS('getData');
  await delay();
  return loadStore();
}

export async function insertData(row) {
  if (!DEMO_MODE) return callGAS('insertData', { row });
  await delay(150);
  const rows = loadStore();
  if (rows.some((r) => r.invoice.trim().toLowerCase() === row.invoice.trim().toLowerCase() && r.item.trim().toLowerCase() === row.item.trim().toLowerCase())) {
    throw new Error('Duplicate invoice + item combination already exists');
  }
  const newRow = { ...row, id: uid('row'), margin: calcMargin(row.purchase, row.selling) };
  rows.unshift(newRow);
  saveStore(rows);
  return newRow;
}

export async function updateData(id, patch) {
  if (!DEMO_MODE) return callGAS('updateData', { id, row: patch });
  await delay(150);
  const rows = loadStore();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Row not found');
  rows[idx] = { ...rows[idx], ...patch };
  saveStore(rows);
  return rows[idx];
}

export async function deleteData(id) {
  if (!DEMO_MODE) return callGAS('deleteData', { id });
  await delay(150);
  const rows = loadStore();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Row not found');
  const [removed] = rows.splice(idx, 1);
  saveStore(rows);
  return removed;
}

export async function bulkDelete(ids) {
  if (!DEMO_MODE) return callGAS('bulkDelete', { ids });
  await delay(200);
  let rows = loadStore();
  rows = rows.filter((r) => !ids.includes(r.id));
  saveStore(rows);
  return ids.length;
}

export async function bulkUpdate(ids, patch) {
  if (!DEMO_MODE) return callGAS('bulkUpdate', { ids, row: patch });
  await delay(200);
  const rows = loadStore();
  rows.forEach((r) => { if (ids.includes(r.id)) Object.assign(r, patch); });
  saveStore(rows);
  return ids.length;
}

export async function restoreRow(row) {
  if (!DEMO_MODE) return callGAS('insertData', { row });
  await delay(100);
  const rows = loadStore();
  rows.unshift(row);
  saveStore(rows);
  return row;
}
