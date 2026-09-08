import { mountShell } from './app.js';
import { getSetting, setSetting, toast, $ } from './utils.js';
import { can } from './auth.js';

const shell = mountShell('settings', 'Settings');
if (shell) init();

function init() {
  const { contentEl, session } = shell;
  const logo = getSetting('companyLogo', '');

  contentEl.innerHTML = `
    <div class="card" style="max-width:640px;">
      <div class="card-head"><h3>Company Profile</h3></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field full">
            <label>Company Name</label>
            <input id="s_company" type="text" value="${getSetting('companyName', 'Sales Dispatch Management')}" />
          </div>
          <div class="field full">
            <label>Logo</label>
            <div class="flex items-center gap-3">
              <div id="logoPreview" style="width:56px;height:56px;border-radius:12px;background:var(--bg-alt);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;">
                ${logo ? `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;" />` : '<span style="color:var(--text-faint);font-size:11px;">No logo</span>'}
              </div>
              <input type="file" id="s_logo" accept="image/*" />
            </div>
          </div>
          <div class="field">
            <label>Currency Symbol</label>
            <select id="s_currency">
              ${['₹','$','€','£'].map((c) => `<option ${getSetting('currency','₹')===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Date Format</label>
            <select id="s_dateFormat">
              ${['DD-MM-YYYY','MM-DD-YYYY','YYYY-MM-DD'].map((f) => `<option ${getSetting('dateFormat','DD-MM-YYYY')===f?'selected':''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Theme</label>
            <select id="s_theme">
              <option value="light" ${!getSetting('darkMode',false)?'selected':''}>Light</option>
              <option value="dark" ${getSetting('darkMode',false)?'selected':''}>Dark</option>
            </select>
          </div>
          <div class="field">
            <label>Auto Backup</label>
            <select id="s_backup">
              <option value="on" ${getSetting('autoBackup',true)?'selected':''}>On (daily snapshot)</option>
              <option value="off" ${!getSetting('autoBackup',true)?'selected':''}>Off</option>
            </select>
          </div>
        </div>
        <div style="margin-top:18px;"><button class="btn btn-primary" id="saveSettings">Save Settings</button></div>
      </div>
    </div>

    ${can('manageUsers') ? `
    <div class="card" style="max-width:640px;margin-top:16px;">
      <div class="card-head"><h3>Roles &amp; Permissions</h3></div>
      <div class="card-body">
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Role</th><th>Insert</th><th>Edit</th><th>Delete</th><th>Export</th></tr></thead>
          <tbody>
            <tr><td>Admin</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
            <tr><td>Sales</td><td>✅</td><td>Own entries</td><td>—</td><td>✅</td></tr>
            <tr><td>Viewer</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="card" style="max-width:640px;margin-top:16px;">
      <div class="card-head"><h3>Session</h3></div>
      <div class="card-body">
        <p class="text-mute" style="font-size:13px;">Signed in as <b>${session.name}</b> (${session.role}).</p>
      </div>
    </div>
  `;

  $('#s_logo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSetting('companyLogo', reader.result);
      $('#logoPreview').innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;" />`;
    };
    reader.readAsDataURL(file);
  });

  $('#saveSettings').addEventListener('click', () => {
    setSetting('companyName', $('#s_company').value.trim());
    setSetting('currency', $('#s_currency').value);
    setSetting('dateFormat', $('#s_dateFormat').value);
    setSetting('autoBackup', $('#s_backup').value === 'on');
    const dark = $('#s_theme').value === 'dark';
    setSetting('darkMode', dark);
    document.documentElement.classList.toggle('dark', dark);
    toast('Settings saved', 'success');
  });
}
