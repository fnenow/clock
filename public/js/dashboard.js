// Helper: format duration in h m
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

// Helper: get unique values for dropdowns
function getUnique(entries, field) {
  return Array.from(new Set(entries.map(e => e[field]))).filter(Boolean);
}

// Pair in/out entries into sessions
function getSessions(entries) {
  // Sort all entries by worker, project, datetime
  entries.sort((a, b) => {
    if (a.worker_name !== b.worker_name) return a.worker_name.localeCompare(b.worker_name);
    if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
    return new Date(a.datetime_local) - new Date(b.datetime_local);
  });

  const sessions = [];
  const pending = {};

  entries.forEach(entry => {
    const key = `${entry.worker_name}|${entry.project_name}`;
    if (entry.action === 'in') {
      if (!pending[key]) {
        pending[key] = { 
          worker_name: entry.worker_name, 
          project_name: entry.project_name, 
          clock_in: entry.datetime_local, 
          note: entry.note,
          pay_rate: entry.pay_rate,
          id_in: entry.id, // for reference
          clock_out: null, 
          id_out: null
        };
      }
    } else if (entry.action === 'out' && pending[key] && !pending[key].clock_out) {
      pending[key].clock_out = entry.datetime_local;
      pending[key].id_out = entry.id;
      sessions.push(pending[key]);
      delete pending[key];
    }
  });

  // Any open (not clocked out) sessions left in pending
  for (const key in pending) {
    sessions.push(pending[key]);
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
  workerSel.innerHTML = '<option value="">All</option>' + getUnique(allEntries, 'worker_name').map(w => `<option>${w}</option>`).join('');
  projectSel.innerHTML = '<option value="">All</option>' + getUnique(allEntries, 'project_name').map(p => `<option>${p}</option>`).join('');
}

function renderSessions() {
  const tbody = document.querySelector('#sessionTable tbody');
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
document.getElementById('filterWorker').addEventListener('change', e => {
  filterWorker = e.target.value;
  renderSessions();
});
document.getElementById('filterProject').addEventListener('change', e => {
  filterProject = e.target.value;
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
