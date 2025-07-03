//copilot v3 === Full updated dashboard.js: group by day, then worker for cleaner report ===

function formatDurationLocal(start, end) {
  if (!start) return '';
  if (!end) return '';
  const [sDate, sTime] = start.split(' ');
  const [eDate, eTime] = end.split(' ');
  const [sy, sm, sd] = sDate.split('-').map(Number);
  const [ey, em, ed] = eDate.split('-').map(Number);
  const [sh, smin] = sTime.split(':').map(Number);
  const [eh, emin] = eTime.split(':').map(Number);

  const startMins = ((sy * 12 + (sm - 1)) * 31 + (sd - 1)) * 24 * 60 + sh * 60 + smin;
  const endMins   = ((ey * 12 + (em - 1)) * 31 + (ed - 1)) * 24 * 60 + eh * 60 + emin;
  const diff = endMins - startMins;
  if (diff < 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

// Groups sessions by day, then worker, then project
function getSessions(entries) {
  // 1. Pair in/out by session_id
  const bySession = {};
  for (const e of entries) {
    if (!bySession[e.session_id]) bySession[e.session_id] = {};
    bySession[e.session_id][e.action] = e;
  }

  // 2. Build raw session list
  const sessions = [];
  for (const [session_id, pair] of Object.entries(bySession)) {
    const inEntry = pair.in;
    const outEntry = pair.out;
    if (!inEntry) continue; // skip incomplete
    const clockInStr = inEntry?.datetime_local || '';
    const clockOutStr = outEntry?.datetime_local || '';
    let duration = '';
    let durationMinutes = 0;
    if (clockInStr && clockOutStr) {
      const [sDate, sTime] = clockInStr.split(' ');
      const [eDate, eTime] = clockOutStr.split(' ');
      const [sy, sm, sd] = sDate.split('-').map(Number);
      const [ey, em, ed] = eDate.split('-').map(Number);
      const [sh, smin] = sTime.split(':').map(Number);
      const [eh, emin] = eTime.split(':').map(Number);
      const startMins = ((sy * 12 + (sm - 1)) * 31 + (sd - 1)) * 24 * 60 + sh * 60 + smin;
      const endMins   = ((ey * 12 + (em - 1)) * 31 + (ed - 1)) * 24 * 60 + eh * 60 + emin;
      durationMinutes = endMins - startMins;
      duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
    }
    sessions.push({
      session_id,
      worker_id: inEntry.worker_id,
      worker_name: inEntry.worker_name,
      project_id: inEntry.project_id,
      project_name: inEntry.project_name,
      clock_in: clockInStr,
      clock_out: clockOutStr,
      durationMinutes,
      duration,
      pay_rate: parseFloat(inEntry.pay_rate || outEntry?.pay_rate || 0),
      note_in: inEntry.note || '',
      note_out: outEntry?.note || '',
      id_in: inEntry.id,
      id_out: outEntry?.id,
    });
  }

  // 3. Group by day, then worker, then project
  const byDay = {};
  for (const sess of sessions) {
    if (!sess.clock_in || !sess.clock_out) continue;
    const date = sess.clock_in.split(' ')[0]; // 'YYYY-MM-DD'
    if (!byDay[date]) byDay[date] = {};
    if (!byDay[date][sess.worker_id]) {
      byDay[date][sess.worker_id] = {
        worker_id: sess.worker_id,
        worker_name: sess.worker_name,
        projects: {}
      };
    }
    const workerGroup = byDay[date][sess.worker_id];
    const projKey = sess.project_id;
    if (!workerGroup.projects[projKey]) {
      workerGroup.projects[projKey] = {
        project_id: sess.project_id,
        project_name: sess.project_name,
        pay_rate: sess.pay_rate,
        sessions: [],
        totalMinutes: 0,
        notes_in: [],
        notes_out: [],
        session_ids: [],
        ids_in: [],
        ids_out: [],
      };
    }
    const proj = workerGroup.projects[projKey];
    proj.sessions.push(sess);
    proj.totalMinutes += sess.durationMinutes;
    proj.notes_in.push(sess.note_in);
    proj.notes_out.push(sess.note_out);
    proj.session_ids.push(sess.session_id);
    proj.ids_in.push(sess.id_in);
    proj.ids_out.push(sess.id_out);
  }

  // 4. Build final output: array of { date, worker_name, ...project summaries }
  const output = [];
  for (const date of Object.keys(byDay).sort()) {
    for (const worker_id of Object.keys(byDay[date]).sort((a, b) => {
      const nameA = byDay[date][a].worker_name || '';
      const nameB = byDay[date][b].worker_name || '';
      return nameA.localeCompare(nameB);
    })) {
      const workerGroup = byDay[date][worker_id];
      for (const project_id of Object.keys(workerGroup.projects)) {
        const proj = workerGroup.projects[project_id];
        const regularMinutes = Math.min(480, proj.totalMinutes);
        const overtimeMinutes = Math.max(0, proj.totalMinutes - 480);
        const payRate = proj.pay_rate;
        output.push({
          date,
          worker_id,
          worker_name: workerGroup.worker_name,
          project_id,
          project_name: proj.project_name,
          clock_in: proj.sessions[0].clock_in,
          clock_out: proj.sessions[proj.sessions.length - 1].clock_out,
          duration: `${Math.floor(proj.totalMinutes/60)}h ${proj.totalMinutes%60}m`,
          regular_hours: round2(regularMinutes/60),
          overtime_hours: round2(overtimeMinutes/60),
          total_pay: round2((regularMinutes/60)*payRate + (overtimeMinutes/60)*payRate*1.5),
          note_in: proj.notes_in.join('; '),
          note_out: proj.notes_out.join('; '),
          session_ids: proj.session_ids.join(','),
          ids_in: proj.ids_in,
          ids_out: proj.ids_out,
          isOT: overtimeMinutes > 0,
        });
      }
    }
  }
  return output;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isOvertimeSession(session) {
  return session.overtime_hours > 0;
}

// Render with grouping: day, then worker, then list projects as rows under each worker
function renderSessions() {
  const tbody = document.querySelector('#sessionTable tbody');
  let filtered = allSessions.filter(s => {
    if (filterWorker && s.worker_name !== filterWorker) return false;
    if (filterProject && s.project_name !== filterProject) return false;
    if (filterStartDate && (!s.date || s.date < filterStartDate)) return false;
    if (filterEndDate && (!s.date || s.date > filterEndDate)) return false;
    return true;
  });
  if (currentTab === 'open') filtered = filtered.filter(s => !s.clock_out);
  else if (currentTab === 'closed') filtered = filtered.filter(s => !!s.clock_out);

  // Group by date, then worker
  const byDay = {};
  for (const s of filtered) {
    if (!byDay[s.date]) byDay[s.date] = {};
    if (!byDay[s.date][s.worker_id]) byDay[s.date][s.worker_id] = {
      worker_name: s.worker_name,
      projects: []
    };
    byDay[s.date][s.worker_id].projects.push(s);
  }

  let html = '';
  for (const date of Object.keys(byDay).sort()) {
    html += `<tr><td colspan="9" style="background:#eef;font-weight:bold">${date}</td></tr>`;
    for (const worker_id of Object.keys(byDay[date]).sort((a, b) => {
      const nameA = byDay[date][a].worker_name || '';
      const nameB = byDay[date][b].worker_name || '';
      return nameA.localeCompare(nameB);
    })) {
      const workerGroup = byDay[date][worker_id];
      html += `<tr><td colspan="9" style="background:#f8f8ff;font-weight:bold;padding-left:24px">${workerGroup.worker_name}</td></tr>`;
      for (const s of workerGroup.projects) {
        const overtime = highlightOvertime && isOvertimeSession(s);
        html += `
          <tr${overtime ? ' class="overtime"' : ''}>
            <td></td>
            <td><span class="editable" data-type="project" data-session="${s.session_ids}" contenteditable>${s.project_name || ''}</span></td>
            <td><span class="editable" data-type="clock_in" data-session="${s.session_ids}" contenteditable>${s.clock_in || ''}</span></td>
            <td><span class="editable" data-type="clock_out" data-session="${s.session_ids}" contenteditable>${s.clock_out || ''}</span></td>
            <td>${s.duration || ''} (${s.regular_hours}h + <b style="color:red">${s.overtime_hours}h</b>)</td>
            <td><span class="editable" data-type="note_in" data-session="${s.session_ids}" contenteditable>${s.note_in || ''}</span></td>
            <td><span class="editable" data-type="note_out" data-session="${s.session_ids}" contenteditable>${s.note_out || ''}</span></td>
            <td>${s.pay_rate ? `$${s.pay_rate.toFixed(2)}` : ''} ($${s.total_pay})</td>
            <td>${!s.clock_out ? `<button onclick="forceClockOut('${s.session_ids.split(',')[0]}')">Force Clock-Out</button>` : ''}</td>
          </tr>
        `;
      }
    }
  }
  tbody.innerHTML = html;

  document.querySelectorAll('.editable').forEach(span => {
    span.onblur = handleInlineEdit;
  });
}

async function loadData() {
  try {
    const res = await fetch('/api/clock-entries');
    const data = await res.json();
    allEntries = data;
    allSessions = getSessions(allEntries);
    populateFilters();
    renderSessions();
  } catch (err) {
    console.error("loadData failed:", err);
  }
}

function populateFilters() {
  const workerSel = document.getElementById('filterWorker');
  const projectSel = document.getElementById('filterProject');
  const workers = getUnique(allEntries, 'worker_name');
  const projects = getUnique(allEntries, 'project_name');
  workerSel.innerHTML = '<option value="">All</option>' + workers.map(w => `<option>${w}</option>`).join('');
  projectSel.innerHTML = '<option value="">All</option>' + projects.map(p => `<option>${p}</option>`).join('');
}

function getUnique(entries, field) {
  return Array.from(new Set(entries.map(e => e[field]))).filter(Boolean);
}

// Event bindings
const otCheckbox = document.getElementById('highlightOvertime');
otCheckbox.addEventListener('change', e => {
  highlightOvertime = e.target.checked;
  renderSessions();
});

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

function updateTabs() {
  document.getElementById('tabOpen').classList.toggle('selected', currentTab === 'open');
  document.getElementById('tabClosed').classList.toggle('selected', currentTab === 'closed');
  document.getElementById('tabAll').classList.toggle('selected', currentTab === 'all');
}

async function handleInlineEdit(e) {
  const span = e.target;
  const newValue = span.innerText.trim();
  const type = span.getAttribute('data-type');
  const sessionIds = span.getAttribute('data-session').split(',');
  // For batch editing, update all sessions for that day
  for (const sessionId of sessionIds) {
    const session = allSessions.find(s => s.session_ids?.split(',').includes(sessionId) || s.session_id === sessionId);
    if (!session) continue;

    if (type === 'project') {
      for (const id of session.ids_in) await patchEntry(id, { project_name: newValue });
      for (const id of session.ids_out) await patchEntry(id, { project_name: newValue });
    } else if (type === 'clock_in' && session.ids_in.length) {
      await patchEntry(session.ids_in[0], { datetime_local: newValue });
    } else if (type === 'clock_out' && session.ids_out.length) {
      await patchEntry(session.ids_out[session.ids_out.length-1], { datetime_local: newValue });
    } else if (type === 'note_in' && session.ids_in.length) {
      await patchEntry(session.ids_in[0], { note: newValue });
    } else if (type === 'note_out' && session.ids_out.length) {
      await patchEntry(session.ids_out[session.ids_out.length-1], { note: newValue });
    }
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

async function forceClockOut(session_id) {
  if (!confirm("Force clock out now?")) return;
  const res = await fetch(`/api/clock-entries/${session_id}/force-clock-out`, { method: 'POST' });
  if (res.ok) await loadData();
  else alert("Failed to force clock out");
}

// CSV Export
document.getElementById('exportCSV').addEventListener('click', () => {
  let csv = [
    [
      "Date",
      "Worker",
      "Project",
      "Clock-in (local)",
      "Clock-out (local)",
      "Duration",
      "Regular Hours",
      "Overtime Hours",
      "Total Pay",
      "Note In",
      "Note Out"
    ].join(',')
  ];
  for (const s of allSessions) {
    csv.push([
      `"${s.date}"`,
      `"${s.worker_name}"`,
      `"${s.project_name}"`,
      `"${s.clock_in}"`,
      `"${s.clock_out}"`,
      `"${s.duration}"`,
      `"${s.regular_hours}"`,
      `"${s.overtime_hours}"`,
      `"${s.total_pay}"`,
      `"${s.note_in.replace(/"/g, '""')}"`,
      `"${s.note_out.replace(/"/g, '""')}"`
    ].join(','));
  }
  const blob = new Blob([csv.join('\r\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sessions.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// Globals
let allEntries = [];
let allSessions = [];
let filterWorker = '';
let filterProject = '';
let filterStartDate = '';
let filterEndDate = '';
let currentTab = 'open';
let highlightOvertime = false;

// Initial load
loadData();
