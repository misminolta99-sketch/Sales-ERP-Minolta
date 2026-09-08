# Sales Dispatch Management ERP

A lightweight ERP for tracking sales dispatch, built with plain HTML/CSS/JS,
Google Sheets as the database, and Google Apps Script as the API. No backend
server, no framework — deploys straight to Netlify as static files.

## What's included

| Area | Status |
|---|---|
| Login with 3 roles (Admin / Sales / Viewer) | ✅ Full |
| Dashboard — 8 KPI cards + 6 Chart.js charts + recent transactions | ✅ Full |
| Transactions — sortable/searchable table, sticky header + first column, pagination, column visibility | ✅ Full |
| Advanced filters — multi-select searchable dropdowns, date range, numeric ranges, save/apply/reset, remembers last filter | ✅ Full |
| Add / Edit / Delete — modal form, required-field + duplicate-invoice validation, live margin calc, undo delete | ✅ Full |
| Bulk operations — select rows, bulk delete / status / warehouse update / export | ✅ Full |
| Export — Excel (SheetJS), CSV, Print, filtered-rows-only, dated filename | ✅ Full |
| Warehouse / Reports / Settings pages | ✅ Functional (aggregated views, report generator, profile & preferences) |
| Dark mode, responsive layout, toasts, skeleton loading | ✅ Full |
| Keyboard shortcuts (Ctrl+F search, Ctrl+E export) | ✅ Full |
| Role-based permissions (insert/edit/delete/export/manage users) | ✅ Enforced in UI |
| Google Apps Script backend (`Code.gs`) | ✅ Included, ready to deploy |

**Intentionally simplified** (noted here so nothing surprises you):
- **Auth is demo-grade.** The login screen accepts any username/password and just sets the chosen role — it's a UI/permissions demo, not a security boundary. Before going live, add real credential checks inside `Code.gs` (see "Security" below).
- **20,000+ row performance** is handled via pagination + client-side filtering rather than true virtual scrolling. This comfortably handles a few thousand rows; for 20k+ rows daily, consider adding a `getDashboard`/paged `getData` call so the Sheet doesn't have to be read in full on every load.
- **Offline cache / activity log** are not implemented — everything reads live from the Sheet (or the local demo store). Easy to add with `localStorage` snapshots if you need it.
- "Infinite scroll" and "pagination" were both requested; the build uses pagination (more predictable for an ERP table) and skips infinite scroll.

## Running it right now (no setup)

Open `index.html` (or deploy the folder to Netlify) and log in with any
username — the app ships in **demo mode**, backed by sample rows drawn from
your uploaded sheet, stored in the browser's `localStorage`. Every feature
(add/edit/delete, filters, export, reports) works immediately so you can
click through the whole app before touching Google Sheets.

## Going live: connect your real Google Sheet

1. **Prepare the Sheet.** Open your Google Sheet and make sure there's a tab
   named `Data` with this header row (add an `ID` column if you don't have
   one — it's how rows are matched for edit/delete):
   `ID | Date | Invoice No | Selling Party | Transport | Item Name | Packing | Quantity | Purchased Party | Warehouse | Purchase Price | Selling Price | Sales Person | Status | Remarks`

2. **Deploy the API.** In the Sheet: `Extensions → Apps Script`, delete the
   placeholder code, paste in `google-apps-script/Code.gs`, then
   `Deploy → New deployment → type: Web app`, set **Execute as: Me** and
   **Who has access: Anyone**, then Deploy. Copy the `/exec` URL it gives you.

3. **Point the app at it.** Open `js/api.js` and paste the URL into:
   ```js
   export const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
   That's it — `DEMO_MODE` turns off automatically and every page (dashboard,
   transactions, warehouse, reports) now reads/writes the real Sheet.

## Deploying to Netlify

- **Drag-and-drop:** zip the `Sales-ERP` folder contents (not the folder
  itself) and drag them onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **Git-based:** push this folder to a GitHub repo, then in Netlify choose
  "Import from Git" with build command left blank and publish directory `/`.
- No environment variables or build step are required — it's static files.

## Security notes before real-world use

- Add real credential verification to `Code.gs` (e.g. a `Users` sheet with
  hashed passwords) and validate `body.token` on every `doPost` call — right
  now the token is generated client-side and not checked server-side.
- Apps Script Web Apps deployed as "Anyone" are reachable by anyone with the
  URL; treat the URL like a secret, and add server-side role checks (don't
  rely solely on the browser hiding buttons) before storing sensitive data.
- Sanitize/validate inputs server-side too — the client does basic
  validation (required fields, duplicate invoice check) but a determined
  caller could bypass the UI and call the API directly.

## Folder structure

```
Sales-ERP/
├── index.html            Login
├── dashboard.html
├── transactions.html
├── warehouse.html
├── reports.html
├── settings.html
├── css/style.css         Full design system (tokens, layout, dark mode)
├── js/
│   ├── app.js             Shared shell (sidebar/topbar)
│   ├── auth.js             Login/session/permissions
│   ├── api.js              Data layer (live Apps Script or demo store)
│   ├── seed-data.js        Demo dataset
│   ├── table.js             Transactions grid + CRUD + export
│   ├── filters.js           Advanced filter panel
│   ├── charts.js            Chart.js wrapper
│   ├── dashboard.js / warehouse.js / reports.js / settings.js
│   └── utils.js             Shared helpers
├── google-apps-script/Code.gs
└── README.md (this file)
```

## Extending it

- **More KPIs / charts:** add to `js/dashboard.js`, follow the existing
  `groupSum`/`topN` pattern.
- **New filter field:** add to `MULTI_FIELDS` or `RANGE_FIELDS` in
  `js/filters.js` — the UI and `applyFilters()` pick it up automatically.
- **New column:** add to `COLUMNS` in `js/table.js`.
