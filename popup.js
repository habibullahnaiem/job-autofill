let selectedKey = null;
const $ = (id) => document.getElementById(id);
function status(message) { $('status').textContent = message || ''; }
function editorUrl(key) { return chrome.runtime.getURL(`editor.html?profile=${encodeURIComponent(key)}`); }

async function createJobProfile() {
  const key = `JOB_${Date.now()}`;
  const profile = { _type: 'JOB', _savedName: 'New Job Profile', basicInfo: {}, presentAddress: {}, permanentAddress: {}, education: [] };
  await chrome.storage.local.set({ [key]: profile, lastProfile_JOB: key });
  chrome.tabs.create({ url: editorUrl(key) });
}
function profileName(key, profile) { return profile?._savedName || profile?.basicInfo?.applicantName || key; }

async function getJobEntries() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all).filter(([key, value]) => key.startsWith('JOB_') && value && typeof value === 'object');
}
async function renderProfiles() {
  const entries = await getJobEntries();
  const list = $('profileList'); list.textContent = '';
  if (!entries.length) { list.innerHTML = '<div class="empty">No job profiles yet. Create one above.</div>'; return; }
  const all = Object.fromEntries(entries);
  if (!selectedKey || !all[selectedKey]) selectedKey = entries[0][0];
  for (const [key, profile] of entries.sort((a, b) => profileName(a[0], a[1]).localeCompare(profileName(b[0], b[1])))) {
    const row = document.createElement('div'); row.className = `profile${key === selectedKey ? ' selected' : ''}`;
    row.addEventListener('click', () => { selectedKey = key; renderProfiles(); });
    const name = document.createElement('span'); name.className = 'profile-name'; name.textContent = profileName(key, profile);
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'JOB';
    const edit = document.createElement('button'); edit.className = 'edit'; edit.textContent = 'Edit';
    edit.addEventListener('click', (event) => { event.stopPropagation(); chrome.tabs.create({ url: editorUrl(key) }); });
    const del = document.createElement('button'); del.className = 'delete'; del.textContent = 'Delete';
    del.addEventListener('click', async (event) => { event.stopPropagation(); if (confirm(`Delete ${profileName(key, profile)}?`)) { await chrome.storage.local.remove(key); if (selectedKey === key) selectedKey = null; await renderProfiles(); status('Profile deleted.'); } });
    row.append(name, badge, edit, del); list.appendChild(row);
  }
}

async function exportProfiles() {
  const entries = await getJobEntries();
  if (!entries.length) return status('No profiles to export.');
  const payload = { format: 'personal-job-autofill', version: 1, exportedAt: new Date().toISOString(), profiles: entries.map(([, profile]) => profile) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `job-profiles-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); status(`${entries.length} profile(s) exported.`);
}
async function importProfiles(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    if (!Array.isArray(profiles) || !profiles.length) throw new Error('No profiles found');
    let count = 0;
    for (const incoming of profiles) {
      if (!incoming || typeof incoming !== 'object') continue;
      const profile = { ...incoming, _type: 'JOB', _savedName: String(incoming._savedName || incoming.basicInfo?.applicantName || 'Imported Job Profile') };
      const key = `JOB_${Date.now()}_${count}`;
      await chrome.storage.local.set({ [key]: profile }); count++;
    }
    await renderProfiles(); status(`${count} profile(s) imported.`);
  } catch (error) { console.error(error); status('Invalid profile JSON file.'); }
  $('importFile').value = '';
}

$('newJob').addEventListener('click', createJobProfile);
$('exportProfiles').addEventListener('click', exportProfiles);
$('importProfiles').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (event) => { if (event.target.files[0]) importProfiles(event.target.files[0]); });
$('autofill').addEventListener('click', async () => {
  if (!selectedKey) return status('Select or create a job profile first.');
  const data = await chrome.storage.local.get(selectedKey); if (!data[selectedKey]) return status('Profile not found.');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes('teletalk.com.bd')) return status('Open a Teletalk job form page first.');
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js', 'job-fallback.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'FILL_JOB_APP', data: data[selectedKey] });
    status('Job autofill started.'); window.close();
  } catch (error) { console.error(error); status('Could not run on this Teletalk page.'); }
});
renderProfiles();
