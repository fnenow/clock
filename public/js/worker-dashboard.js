let allEntries = [];
let allSessions = [];
let filterProject = '';
let filterStartDate = '';
let filterEndDate = '';
let currentTab = 'open';
let currentWorker = null;
let durationInterval;

async function checkLogin() {
  const res = await fetch('/api/worker-dashboard/check', { credentials: 'include' });
  if (!res.ok) {
    window.location = '/timeclock.html';
    return false;
  }
  const data = await res.json();
  currentWorker = { worker_id: data.worker_id, name: data.name };
  document.getElementById('greeting').textContent = `Worker: ${currentWorker.name} (${currentWorker.worker_id})`;
  return true;
}

function formatDuration(start, end) {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate - startDate;
  if (diffMs < 0) return '';
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${h}h ${m}m`;
}
function getDurationHours(start, end) {
  if (!start) return 0;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate - startDate;
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

function getSessions(entries) {
  const bySession = {};
  for (const e of entries) {
    if (!bySession[e.session_id]) bySession[e.session_id] = {};
    bySession[e.session_id][e.action] = e;
  }
  const sessions = [];
  for (const [session_id, pair] of Object.entries(bySession)) {
    const inEntry = pair.in;
    const outEntry = pair.out;
    const durationHours = inEntry ? getDurationHours(inEntry.datetime_local, outEntry?.datetime_local) : 0;
    const payRate = inEntry?.pay_rate || outEntry?.pay_rate || 0;
    const amount = payRate && durationHours ? (payRate * durationHours) : 0;
    sessions.push({
      session_id,
      project_name: inEntry?.project_name || outEntry?.project_name,
      clock_in: inEntry?.datetime_local || '',
      clock_out: outEntry?.datetime_local || '',
      duration: inEntry ? formatDuration(inEntry.datetime_local, outEntry?.datetime_local) : '',
      durationHours,
      amount,
      note_in: inEntry?.note || '',
      note_out: outEntry?.note || '',
      pay_rate: payRate,
      id_in: inEntry?.id,
      id_out: outEntry?.id
    });
  }
  return sessions;
}

function getUnique(entries, field) {
  return Array.from(new Set(entries.map(e => e[field]))).filter(Boolean);
}

async function loadWorkerAndData() {
  if (!await checkLogin()) return;
  const res = await fetch(`/api/worker-dashboard/entries`, { credentials: 'include' });
  allEntries = await res.json();
  allSessions = getSessions(allEntries);
  populateFilters();
  renderSessions();

  if (durationInterval) clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    allSessions = getSessions(allEntries);
    renderSessions();
  }, 60000);
}

function populateFilters() {
  const projectSel = document.getElementById('filterProject');
  const projects = getUnique(allEntries, 'project_name');
  projectSel.innerHTML = '<option value="">All</option>' + projects.map(p => `<option>${p}</option>`).join('');
}

function renderSessions() {
  const tbody = document.querySelector('#sessionTable tbody');
  let filtered = allSessions.filter(s => {
    if (filterProject && s.project_name !== filterProject) return false;
    if (filterStartDate && (!s.clock_in || s.clock_in < filterStartDate)) return false;
    if (filterEndDate && (!s.clock_in || s.clock_in > filterEndDate + " 23:59")) return false;
    return true;
  });
  if (currentTab === 'open') filtered = filtered.filter(s => !s.clock_out);
  else if (currentTab === 'closed') filtered = filtered.filter(s => !!s.clock_out);
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.project_name || ''}</td>
      <td>${s.clock_in || ''}</td>
      <td>${s.clock_out || ''}</td>
      <td>${s.duration || ''}</td>
      <td>${s.amount ? `$${s.amount.toFixed(2)}` : ''}</td>
      <td><span class="editable" data-type="note_in" data-session="${s.session_id}" contenteditable>${s.note_in || ''}</span></td>
      <td><span class="editable" data-type="note_out" data-session="${s.session_id}" contenteditable>${s.note_out || ''}</span></td>
      <td>${s.pay_rate ? `$${parseFloat(s.pay_rate).toFixed(2)}` : ''}</td>
    </tr>
  `).join('');
  document.querySelectorAll('.editable').forEach(span => {
    span.onblur = handleInlineEdit;
  });
}

async function handleInlineEdit(e) {
  const span = e.target;
  const newValue = span.innerText.trim();
  const type = span.getAttribute('data-type');
  const sessionId = span.getAttribute('data-session');
  const session = allSessions.find(s => s.session_id === sessionId);
  if (!session) return;
  if (type === 'note_in' && session.id_in) {
    await patchEntry(session.id_in, { note: newValue });
  } else if (type === 'note_out' && session.id_out) {
    await patchEntry(session.id_out, { note: newValue });
  }
  await loadWorkerAndData();
}

async function patchEntry(id, body) {
  await fetch(`/api/worker-dashboard/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
}

document.getElementById('filterProject').addEventListener('change', e => {
  filterProject = e.target.value;
  renderSessions();
});
document.getElementById('filterStartDate').addEventListener('change', e => {
  filterStartDate = e.target.value;
  renderSessions();
});
document.getElementById('filterEndDate').addEventListener('change', e => {
  filterEndDate = e.target.value;
  renderSessions();
});
document.getElementById('tabOpen').addEventListener('click', () => {
  currentTab = 'open';
  updateTabs();
  renderSessions();
});
document.getElementById('tabClosed').addEventListener('click', () => {
  currentTab = 'closed';
  updateTabs();
  renderSessions();
});
document.getElementById('tabAll').addEventListener('click', () => {
  currentTab = 'all';
  updateTabs();
  renderSessions();
});
function updateTabs() {
  document.getElementById('tabOpen').classList.toggle('selected', currentTab === 'open');
  document.getElementById('tabClosed').classList.toggle('selected', currentTab === 'closed');
  document.getElementById('tabAll').classList.toggle('selected', currentTab === 'all');
}

document.getElementById('exportCSV').addEventListener('click', () => {
  let csv = "Project,Clock-in,Clock-out,Duration,Amount,Note In,Note Out,Pay Rate\n";
  allSessions.forEach(s => {
    csv += `"${s.project_name}","${s.clock_in}","${s.clock_out}","${s.duration}","${s.amount ? `$${s.amount.toFixed(2)}` : ''}","${s.note_in}","${s.note_out}","${s.pay_rate}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_sessions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

loadWorkerAndData();
