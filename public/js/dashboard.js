// Helper: parse "YYYY-MM-DD HH:MM:SS"
function parseDateTime(str) {
  if (!str) return null;
  return new Date(str.replace(' ', 'T'));
}
function formatDuration(start, end) {
  if (!start) return '';
  const startDate = parseDateTime(start);
  const endDate = end ? parseDateTime(end) : new Date();
  const diffMs = endDate - startDate;
  if (diffMs < 0) return '';
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${h}h ${m}m`;
}
function getDurationHours(start, end) {
  if (!start) return 0;
  const startDate = parseDateTime(start);
  const endDate = end ? parseDateTime(end) : new Date();
  const diffMs = endDate - startDate;
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60);
}
function getUnique(entries, field) {
  return Array.from(new Set(entries.map(e => e[field]))).filter(Boolean);
}

// --- MAIN SPLIT LOGIC ---
// Returns an array of session objects (some split for OT)
function getSessions(entries) {
  // Pair by session_id
  const bySession = {};
  for (const e of entries) {
    if (!bySession[e.session_id]) bySession[e.session_id] = {};
    bySession[e.session_id][e.action] = e;
  }
  // Sessions array (before splitting OT)
  const pairedSessions = [];
  for (const [session_id, pair] of Object.entries(bySession)) {
    const inEntry = pair.in;
    const outEntry = pair.out;
    if (!inEntry) continue; // ignore incomplete
    pairedSessions.push({
      session_id,
      worker_id: inEntry.worker_id,
      worker_name: inEntry.worker_name,
      project_id: inEntry.project_id,
      project_name: inEntry.project_name,
      clock_in: inEntry.datetime_local,
      clock_out: outEntry?.datetime_local || '',
      note_in: inEntry.note || '',
      note_out: outEntry?.note || '',
      pay_rate: inEntry.pay_rate || outEntry?.pay_rate || 0,
      id_in: inEntry.id,
      id_out: outEntry?.id
    });
  }
  // Group sessions by worker+date
  const grouped = {};
  function getDay(str) { return str ? str.slice(0, 10) : ''; }
  for (const s of pairedSessions) {
    if (!s.clock_out) continue; // only closed sessions
    const key = `${s.worker_id}|${getDay(s.clock_in)}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  // Sort sessions per group by clock_in
  Object.values(grouped).forEach(arr => arr.sort((a, b) => parseDateTime(a.clock_in) - parseDateTime(b.clock_in)));
  // Now split last session if needed
  let sessions = [];
  for (const [key, daySessions] of Object.entries(grouped)) {
    let totalHours = 0;
    for (let i = 0; i < daySessions.length; ++i) {
      const s = daySessions[i];
      const start = parseDateTime(s.clock_in);
      const end = parseDateTime(s.clock_out);
      const duration = getDurationHours(s.clock_in, s.clock_out);
      // Last session of the day
      if (i === daySessions.length - 1 && totalHours + duration > 8) {
        const regularLeft = Math.max(8 - totalHours, 0);
        const overtimeHours = duration - regularLeft;
        if (regularLeft > 0) {
          // Regular part
          const regEnd = new Date(start.getTime() + regularLeft * 3600 * 1000);
          sessions.push({
            ...s,
            clock_in: s.clock_in,
            clock_out: regEnd.toISOString().slice(0, 19).replace('T', ' '),
            duration: formatDuration(s.clock_in, regEnd.toISOString().slice(0, 19).replace('T', ' ')),
            durationHours: regularLeft,
            amount: s.pay_rate * regularLeft,
            isOvertime: false,
            ot_split: true
          });
        }
        // Overtime part
        const otStart = new Date(start.getTime() + regularLeft * 3600 * 1000);
        sessions.push({
          ...s,
          clock_in: otStart.toISOString().slice(0, 19).replace('T', ' '),
          clock_out: s.clock_out,
          duration: formatDuration(otStart.toISOString().slice(0, 19).replace('T', ' '), s.clock_out),
          durationHours: overtimeHours,
          amount: s.pay_rate * 1.5 * overtimeHours,
          isOvertime: true,
          ot_split: true
        });
        totalHours += duration;
      } else {
        // Not split
        const isOvertime = (totalHours >= 8);
        const durationPay = isOvertime ? s.pay_rate * 1.5 * duration : s.pay_rate * duration;
        sessions.push({
          ...s,
          duration: formatDuration(s.clock_in, s.clock_out),
          durationHours: duration,
          amount: durationPay,
          isOvertime,
          ot_split: false
        });
        totalHours += duration;
      }
    }
  }
  // Handle open sessions (not closed)
  for (const s of pairedSessions) {
    if (!s.clock_out) {
      sessions.push({
        ...s,
        duration: formatDuration(s.clock_in, ''),
        durationHours: getDurationHours(s.clock_in, ''),
        amount: '',
        isOvertime: false,
        ot_split: false
      });
    }
  }
  return sessions;
}

// All other code from your original (unchanged, but now sessions may be split)
let allEntries = [];
let allSessions = [];
let filterWorker = '';
let filterProject = '';
let filterStartDate = '';
let filterEndDate = '';
let currentTab = 'open';
let highlightOvertime = false;
let durationInterval;

async function loadData() {
  const res = await fetch('/api/clock-entries');
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
  const workerSel = document.getElementById('filterWorker');
  const projectSel = document.getElementById('filterProject');
  const workers = getUnique(allEntries, 'worker_name');
  const projects = getUnique(allEntries, 'project_name');
  workerSel.innerHTML = '<option value="">All</option>' + workers.map(w => `<option>${w}</option>`).join('');
  projectSel.innerHTML = '<option value="">All</option>' + projects.map(p => `<option>${p}</option>`).join('');
}
function renderSessions() {
  const tbody = document.querySelector('#sessionTable tbody');
  let filtered = allSessions.filter(s => {
    if (filterWorker && s.worker_name !== filterWorker) return false;
    if (filterProject && s.project_name !== filterProject) return false;
    if (filterStartDate && (!s.clock_in || s.clock_in < filterStartDate)) return false;
    if (filterEndDate && (!s.clock_in || s.clock_in > filterEndDate + " 23:59")) return false;
    return true;
  });
  if (currentTab === 'open') filtered = filtered.filter(s => !s.clock_out);
  else if (currentTab === 'closed') filtered = filtered.filter(s => !!s.clock_out);

  tbody.innerHTML = filtered.map(s => {
    const overtime = highlightOvertime && s.isOvertime;
    return `
      <tr${overtime ? ' class="overtime"' : ''}>
        <td>${s.worker_name || ''}</td>
        <td>
          <span class="editable" data-type="project" data-session="${s.session_id}" contenteditable>${s.project_name || ''}</span>
        </td>
        <td>
          <span class="editable" data-type="clock_in" data-session="${s.session_id}" contenteditable>${s.clock_in || ''}</span>
        </td>
        <td>
          <span class="editable" data-type="clock_out" data-session="${s.session_id}" contenteditable>${s.clock_out || ''}</span>
        </td>
        <td>${s.duration || ''}</td>
        <td>${typeof s.amount === 'number' ? `$${s.amount.toFixed(2)}` : ''}</td>
        <td>
          <span class="editable" data-type="note_in" data-session="${s.session_id}" contenteditable>${s.note_in || ''}</span>
        </td>
        <td>
          <span class="editable" data-type="note_out" data-session="${s.session_id}" contenteditable>${s.note_out || ''}</span>
        </td>
        <td>${s.pay_rate ? `$${parseFloat(s.pay_rate).toFixed(2)}` : ''}${s.isOvertime ? ' <span style="color:red;">OT</span>' : ''}</td>
        <td>
          ${!s.clock_out ? `<button onclick="forceClockOut('${s.id_in}')">Force Clock-Out</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
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
  // Patch backend for changed value
  if (type === 'project') {
    if (session.id_in)
      await patchEntry(session.id_in, { project_name: newValue });
    if (session.id_out)
      await patchEntry(session.id_out, { project_name: newValue });
  } else if (type === 'clock_in' && session.id_in) {
    await patchEntry(session.id_in, { datetime_local: newValue });
  } else if (type === 'clock_out' && session.id_out) {
    await patchEntry(session.id_out, { datetime_local: newValue });
  } else if (type === 'note_in' && session.id_in) {
    await patchEntry(session.id_in, { note: newValue });
  } else if (type === 'note_out' && session.id_out) {
    await patchEntry(session.id_out, { note: newValue });
  }
  await loadData();
}
async function patchEntry(id, body) {
  await fetch(`/api/clock-entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
document.getElementById('filterWorker').addEventListener('change', e => {
  filterWorker = e.target.value;
  renderSessions();
});
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
document.getElementById('highlightOvertime').addEventListener('change', e => {
  highlightOvertime = e.target.checked;
  renderSessions();
});
function updateTabs() {
  document.getElementById('tabOpen').classList.toggle('selected', currentTab === 'open');
  document.getElementById('tabClosed').classList.toggle('selected', currentTab === 'closed');
  document.getElementById('tabAll').classList.toggle('selected', currentTab === 'all');
}
async function forceClockOut(id_in) {
  if (!confirm("Force clock out now?")) return;
  const res = await fetch(`/api/clock-entries/${id_in}/force-clock-out`, { method: 'POST' });
  if (res.ok) {
    await loadData();
  } else {
    alert("Failed to force clock out");
  }
}
window.forceClockOut = forceClockOut;
document.getElementById('exportCSV').addEventListener('click', () => {
  let csv = "Worker,Project,Clock-in,Clock-out,Duration,Amount,Note In,Note Out,Pay Rate\n";
  allSessions.forEach(s => {
    csv += `"${s.worker_name}","${s.project_name}","${s.clock_in}","${s.clock_out}","${s.duration}","${typeof s.amount === 'number' ? `$${s.amount.toFixed(2)}` : ''}","${s.note_in}","${s.note_out}","${s.pay_rate}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sessions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
loadData();
