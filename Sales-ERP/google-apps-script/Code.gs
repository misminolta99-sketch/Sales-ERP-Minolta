/**
 * Sales Dispatch Management ERP — Google Apps Script backend
 * ------------------------------------------------------------
 * Deploy: Extensions > Apps Script > paste this file > Deploy >
 * New deployment > type "Web app" > Execute as "Me" > Who has
 * access "Anyone" > Deploy. Copy the /exec URL into js/api.js
 * (API_URL constant).
 *
 * Sheet requirements: a sheet named "Data" with header row:
 * ID | Date | Invoice No | Selling Party | Transport | Item Name |
 * Packing | Quantity | Purchased Party | Warehouse | Purchase Price |
 * Selling Price | Sales Person | Status | Remarks
 *
 * (If your sheet has no ID column yet, add one — it's used as the
 * stable row identifier for edit/delete instead of row position.)
 */

const SHEET_NAME = 'Data';
const HEADERS = ['ID','Date','Invoice No','Selling Party','Transport','Item Name','Packing','Quantity','Purchased Party','Warehouse','Purchase Price','Selling Price','Sales Person','Status','Remarks'];

// Map friendly JS keys <-> sheet header labels
const FIELD_MAP = {
  id: 'ID', date: 'Date', invoice: 'Invoice No', sellingParty: 'Selling Party', transport: 'Transport',
  item: 'Item Name', packing: 'Packing', qty: 'Quantity', purchasedParty: 'Purchased Party', warehouse: 'Warehouse',
  purchase: 'Purchase Price', selling: 'Selling Price', salesPerson: 'Sales Person', status: 'Status', remarks: 'Remarks',
};

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function readAllRows_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((c) => c !== '')).map((row, i) => {
    const obj = { _rowIndex: i + 2 }; // +2: header row + 1-index
    headers.forEach((h, idx) => {
      const key = Object.keys(FIELD_MAP).find((k) => FIELD_MAP[k] === h) || h;
      obj[key] = row[idx];
    });
    if (!obj.id) obj.id = 'r' + obj._rowIndex; // fallback stable-ish id
    return obj;
  });
}

function writeRow_(sheet, rowIndex, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = headers.map((h) => {
    const key = Object.keys(FIELD_MAP).find((k) => FIELD_MAP[k] === h);
    return data[key] ?? '';
  });
  sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonOut_({ data: readAllRows_() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;
    switch (action) {
      case 'getData': result = readAllRows_(); break;
      case 'insertData': result = insertData_(body.row); break;
      case 'updateData': result = updateData_(body.id, body.row); break;
      case 'deleteData': result = deleteData_(body.id); break;
      case 'bulkDelete': result = (body.ids || []).map(deleteData_); break;
      case 'bulkUpdate': result = (body.ids || []).map((id) => updateData_(id, body.row)); break;
      case 'searchData': result = searchData_(body.query); break;
      case 'filterData': result = filterData_(body.filters); break;
      case 'getDashboard': result = getDashboard_(); break;
      case 'exportData': result = readAllRows_(); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return jsonOut_({ data: result });
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function insertData_(row) {
  const sheet = getSheet_();
  const rows = readAllRows_();
  const dup = rows.find((r) => String(r.invoice).toLowerCase() === String(row.invoice).toLowerCase() && String(r.item).toLowerCase() === String(row.item).toLowerCase());
  if (dup) throw new Error('Duplicate invoice + item combination already exists');
  const id = Utilities.getUuid();
  const nextRow = sheet.getLastRow() + 1;
  writeRow_(sheet, nextRow, { ...row, id });
  return { ...row, id };
}

function updateData_(id, patch) {
  const rows = readAllRows_();
  const target = rows.find((r) => r.id === id);
  if (!target) throw new Error('Row not found: ' + id);
  const sheet = getSheet_();
  const merged = { ...target, ...patch };
  writeRow_(sheet, target._rowIndex, merged);
  return merged;
}

function deleteData_(id) {
  const rows = readAllRows_();
  const target = rows.find((r) => r.id === id);
  if (!target) throw new Error('Row not found: ' + id);
  getSheet_().deleteRow(target._rowIndex);
  return { id };
}

function searchData_(query) {
  const q = String(query || '').toLowerCase();
  return readAllRows_().filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
}

function filterData_(filters) {
  let rows = readAllRows_();
  if (!filters) return rows;
  Object.keys(filters).forEach((key) => {
    const val = filters[key];
    if (val === undefined || val === '' || (Array.isArray(val) && !val.length)) return;
    rows = rows.filter((r) => Array.isArray(val) ? val.includes(r[key]) : String(r[key]) === String(val));
  });
  return rows;
}

function getDashboard_() {
  const rows = readAllRows_();
  const totalInvoices = new Set(rows.map((r) => r.invoice)).size;
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const pending = rows.filter((r) => r.status === 'Pending').length;
  const delivered = rows.filter((r) => r.status === 'Delivered').length;
  return { totalInvoices, totalQty, pending, delivered, count: rows.length };
}
