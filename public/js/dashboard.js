// Format duration as "xh ym"
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

// Get unique values for dropdowns
function getUnique(entries, field) {
  return Array.from(new Set(entries.map(e => e[field]))).filter(Boolean);
}

// Improved session pairing: handles multiple sessions per worker/project
function getSessions(entries) {
  // Sort all entries by worker, project, datetime
  entries.sort((a, b) => {
    if (a.worker_name !== b.worker_name) return a.worker_name.localeCompare(b.worker_name);
    if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
    return new Date(a.datetime_local) - new Date(b.datetime_local);
  });

  const sessions = [];
  const pending = {}; // key: worker|project, value: array of open "in"s

  entries.forEach(entry => {
    const key = `${entry.worker_name}|${entry.project_name}`;
    if (entry.action === 'in') {
      if (!pending[key]) pending[key] = [];
      pending[key].push({
        worker_name: entry.worker_name,
        project_name: entry.project_name,
        clock_in: entry.datetime_local,
        note: entry.note,
        pay_rate: entry.pay_rate,
        id_in: entry.id,
        clock_out: null,
        id_out: null
      });
    } else if (entry.action === 'out' && pending[key] && pending[key].length) {
      // Match to the earliest unmatched clock-in
      const session = pending[key].shift();
      session.clock_out = entry.datetime_local;
      session.id_out = entry.id;
      sessions.push(session);
    }
  });

  // Any remaining unmatched "in"s are open sessions
  for (const key in pending) {
    sessions.push(...pending[key]);
  }

  return sessions;
}

let allEntries = [];
let allSessions = [];
let filterWorker = '';
let filterProject = '';
let currentTab = 'open'; // 'open', 'closed', 'all'

// Fetch entries and initialize
async function loadData() {
  const res = await fetch('/api/clock-entries');
  allEntries = await res.json();
  allSessions = getSessions(allEntries);
  populateFilters();
  renderSessions();
}

function populateFilters() {
  const workerSel = document.getElementById('filterWorker');
  const projectSel = document.getElementById('filterProject');
  if (!workerSel || !projectSel) return;
  workerSel.innerHTML = '<option value="">All</option>' + getUnique(allEntries, 'worker_name').map(w => `<option>${w}</option>`).join('');
  projectSel.innerHTML = '<option value="">All</option>' + getUnique(allEntries, 'project_name').map(p => `<option>${p}</option>`).join('');
}

function renderSessions() {
  const tbody = document.querySelector('#sessionTable tbody');
  if (!tbody) return;
  let filtered = allSessions.filter(s => {
    let ok = true;
    if (filterWorker && s.worker_name !== filterWorker) ok = false;
    if (filterProject && s.project_name !== filterProject) ok = false;
    return ok;
  });

  if (currentTab === 'open') filtered = filtered.filter(s => !s.clock_out);
  else if (currentTab === 'closed') filtered = filtered.filter(s => !!s.clock_out);
  // 'all' shows everything

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.worker_name}</td>
      <td>${s.project_name}</td>
      <td>${s.clock_in ? new Date(s.clock_in).toLocaleString() : ''}</td>
      <td>${formatDuration(s.clock_in, s.clock_out)}</td>
      <td>${s.note || ''}</td>
      <td>${s.pay_rate ? `$${parseFloat(s.pay_rate).toFixed(2)}` : ''}</td>
      <td>
        ${!s.clock_out ? `<button onclick="forceClockOut('${s.id_in}')">Force Clock-Out</button>` : ''}
      </td>
    </tr>
  `).join('');
}

// Event handlers
const workerSel = document.getElementById('filterWorker');
if (workerSel) workerSel.addEventListener('change', e => {
  filterWorker = e.target.value;
  renderSessions();
});
const projectSel = document.getElementById('filterProject');
if (projectSel) projectSel.addEventListener('change', e => {
  filterProject = e.target.value;
  renderSessions();
});
const tabOpen = document.getElementById('tabOpen');
if (tabOpen) tabOpen.addEventListener('click', () => {
  currentTab = 'open';
  updateTabs();
  renderSessions();
});
const tabClosed = document.getElementById('tabClosed');
if (tabClosed) tabClosed.addEventListener('click', () => {
  currentTab = 'closed';
  updateTabs();
  renderSessions();
});
const tabAll = document.getElementById('tabAll');
if (tabAll) tabAll.addEventListener('click', () => {
  currentTab = 'all';
  updateTabs();
  renderSessions();
});
function updateTabs() {
  if (tabOpen) tabOpen.classList.toggle('selected', currentTab === 'open');
  if (tabClosed) tabClosed.classList.toggle('selected', currentTab === 'closed');
  if (tabAll) tabAll.classList.toggle('selected', currentTab === 'all');
}

// Force clock out: updates the backend and reloads data
async function forceClockOut(id_in) {
  if (!confirm("Force clock out now?")) return;
  const res = await fetch(`/api/clock-entries/${id_in}/force-clock-out`, { method: 'POST' });
  if (res.ok) {
    await loadData();
  } else {
    alert("Failed to force clock out");
  }
}

window.forceClockOut = forceClockOut; // expose to global

// Initial load
loadData();
