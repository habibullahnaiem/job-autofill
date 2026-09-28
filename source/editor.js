const params = new URLSearchParams(location.search);
const profileKey = params.get('profile');
const editor = document.getElementById('editorContent');
const status = document.getElementById('status');
const badge = document.getElementById('profileTypeBadge');
let profile;

const basicFields = ['applicantName', 'applicantNameBangla', 'fatherName', 'fatherNameBangla', 'motherName', 'motherNameBangla', 'dateOfBirth', 'nationalId', 'mobileNumber', 'email', 'religion', 'gender', 'maritalStatus', 'departmentalStatus', 'spouseName'];
const addressFields = ['careOf', 'village', 'district', 'upazila', 'postOffice', 'postCode'];
const educationFields = ['examination', 'board', 'roll', 'reg', 'result', 'group', 'year', 'duration'];

function field(label, path, value = '') {
  const wrap = document.createElement('div'); wrap.className = 'field-row';
  const text = document.createElement('label'); text.textContent = label;
  const input = document.createElement('input'); input.type = 'text'; input.value = value ?? ''; input.dataset.path = path;
  wrap.append(text, input); return wrap;
}
function checkboxField(label, path, checked = false) {
  const wrap = document.createElement('div'); wrap.className = 'field-row';
  const text = document.createElement('label'); text.textContent = label;
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(checked); input.dataset.path = path; input.style.width = '18px'; input.style.height = '18px';
  wrap.append(text, input); return wrap;
}
function section(title, fields) {
  const set = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = title; set.appendChild(legend);
  const grid = document.createElement('div'); grid.className = 'field-grid';
  fields.forEach(([label, path, value]) => grid.appendChild(field(label, path, value)));
  set.appendChild(grid); return set;
}
function get(obj, path) { return path.split('.').reduce((v, k) => v?.[k], obj); }
function render() {
  badge.textContent = 'TELETALK JOB'; badge.style.background = '#cfe2ff'; badge.style.color = '#084298'; editor.textContent = '';
  const settings = section('Profile Settings', [['Profile Name', '_savedName', profile._savedName || 'Job Profile']]);
  settings.querySelector('.field-grid').appendChild(checkboxField('Same as Present Address', 'sameAsPresentAddress', profile.sameAsPresentAddress));
  editor.appendChild(settings);
  editor.appendChild(section('Basic Information', basicFields.map(k => [k, `basicInfo.${k}`, get(profile, `basicInfo.${k}`)])));
  const grid = document.createElement('div'); grid.className = 'main-grid';
  grid.appendChild(section('Present Address', addressFields.map(k => [k, `presentAddress.${k}`, get(profile, `presentAddress.${k}`)])));
  grid.appendChild(section('Permanent Address', addressFields.map(k => [k, `permanentAddress.${k}`, get(profile, `permanentAddress.${k}`)])));
  editor.appendChild(grid);
  const education = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = 'Education'; education.appendChild(legend);
  const list = profile.education || [];
  for (let i = 0; i < Math.max(4, list.length); i++) {
    const block = document.createElement('div'); block.className = 'edu-item'; const heading = document.createElement('h4'); heading.textContent = `Exam ${i + 1}`; block.appendChild(heading);
    const grid = document.createElement('div'); grid.className = 'field-grid';
    educationFields.forEach(k => grid.appendChild(field(k, `education.${i}.${k}`, get(profile, `education.${i}.${k}`))));
    block.appendChild(grid); education.appendChild(block);
  }
  editor.appendChild(education);
}
function set(obj, path, value) {
  const keys = path.split('.'); let cur = obj;
  keys.forEach((key, i) => { if (i === keys.length - 1) cur[key] = value; else cur = cur[key] ??= {}; });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!profileKey || !profileKey.startsWith('JOB_')) { editor.textContent = 'Job profile not found.'; return; }
  const stored = await chrome.storage.local.get(profileKey); profile = stored[profileKey];
  if (!profile) { editor.textContent = 'Job profile not found.'; return; }
  render();
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!profile) return;
  document.querySelectorAll('input[data-path]').forEach(input => set(profile, input.dataset.path, input.type === 'checkbox' ? input.checked : input.value));
  profile._savedName = (profile._savedName || 'Job Profile').trim() || 'Unnamed Job Profile';
  await chrome.storage.local.set({ [profileKey]: profile }); status.textContent = 'Saved locally.'; setTimeout(() => status.textContent = '', 2000);
});
document.getElementById('deleteBtn').addEventListener('click', async () => {
  if (profile && confirm(`Delete ${profile._savedName || profileKey}?`)) { await chrome.storage.local.remove(profileKey); window.close(); }
});
