let currentWorker = null;
let currentProject = null;
let sessionID = null;
let clockedIn = false;
let clockInTime = null;

// Restore sessionID if present in localStorage
if (localStorage.getItem('sessionID')) {
  sessionID = localStorage.getItem('sessionID');
}

async function login() {
  const workerId = document.getElementById('workerId').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/worker/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id: workerId, password })
  });
  const data = await res.json();
  if (data.success) {
    currentWorker = data.worker;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('clock-section').style.display = '';
    document.getElementById('greeting').textContent = `Hi, ${currentWorker.name}`;
    loadClockStatus();
  } else {
    alert(data.message || 'Login failed');
  }
}

async function loadClockStatus() {
  const res = await fetch(`/api/clock/status/${currentWorker.worker_id}`);
  const lastEntry = await res.json();
  clockedIn = lastEntry && lastEntry.action === 'in';

  if (!clockedIn) {
    sessionID = null;
    localStorage.removeItem('sessionID');
    // Not clocked in: show project selection and clock in
    const projectRes = await fetch(`/api/worker/projects/${currentWorker.worker_id}`);
    const projects = await projectRes.json();

    // Get current local time in browser, format for date and time inputs
    const now = luxon.DateTime.now();
    const dateVal = now.toFormat('yyyy-MM-dd');
    const timeVal = now.toFormat('HH:mm:ss');

    let html = `<form id="clockInForm"><div class="mb-2"><label>Project:</label>`;
    for (const p of projects) {
      html += `<div class="form-check">
        <input class="form-check-input" type="radio" name="project" value="${p.id}" id="prj${p.id}">
        <label class="form-check-label" for="prj${p.id}">${p.name}</label>
      </div>`;
    }
    // Date and time inputs default to "now"
    html += `</div>
      <div class="mb-2">
        <label>Date:</label>
        <input type="date" class="form-control" id="customDate" value="${dateVal}">
      </div>
      <div class="mb-2">
        <label>Time:</label>
        <input type="time" class="form-control" id="customTime" step="1" value="${timeVal}">
      </div>
      <div class="mb-2">
        <label>Notes:</label>
        <textarea class="form-control" id="note" rows="3" placeholder="Enter notes here"></textarea>
      </div>
      <button type="button" class="btn btn-success" onclick="clockIn()">Clock In</button>
      </form>
      <div class="mt-2">
        <button class="btn btn-link" onclick="showChangePassword()">Change Password</button>
      </div>`;
    document.getElementById('clock-status').innerHTML = html;
  } else {
    currentProject = lastEntry.project_id;
    sessionID = lastEntry.session_id;
    localStorage.setItem('sessionID', sessionID); // Save for page reload
    clockInTime = new Date(lastEntry.datetime_local);

    // For clock-out, also pre-fill date/time to now
    const now = luxon.DateTime.now();
    const dateVal = now.toFormat('yyyy-MM-dd');
    const timeVal = now.toFormat('HH:mm:ss');

    let html = `<div class="mb-2">Clocked in to Project ID: <b>${lastEntry.project_id}</b> <br>
      Since: ${clockInTime.toLocaleString()}<br>
      <span id="clock-duration" class="fw-bold"></span>
      </div>
      <form id="clockOutForm">
      <div class="mb-2">
        <label>Date:</label>
        <input type="date" class="form-control" id="customDateOut" value="${dateVal}">
      </div>
      <div class="mb-2">
        <label>Time:</label>
        <input type="time" class="form-control" id="customTimeOut" step="1" value="${timeVal}">
      </div>
      <div class="mb-2">
        <label>Clock Out Note:</label>
        <textarea class="form-control" id="noteOut" rows="3" placeholder="Enter notes here"></textarea>
      </div>
      <button type="button" class="btn btn-danger" onclick="clockOut()">Clock Out</button>
      </form>
      <div class="mt-2">
        <button class="btn btn-link" onclick="showChangePassword()">Change Password</button>
      </div>`;
    document.getElementById('clock-status').innerHTML = html;
    updateDuration();
  }
}

function updateDuration() {
  if (!clockInTime) return;
  const now = new Date();
  const diff = now - clockInTime;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  document.getElementById('clock-duration').textContent =
    `Duration: ${h}h ${m}m ${s}s`;
  setTimeout(updateDuration, 1000);
}

async function clockIn() {
  const project_id = document.querySelector('input[name="project"]:checked')?.value;
  if (!project_id) return alert("Please select a project.");
  const note = document.getElementById('note').value;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Always get the values from the date/time fields (can be default or changed)
  let dateVal = document.getElementById('customDate').value;
  let timeVal = document.getElementById('customTime').value;
  let datetime_local;

  if (dateVal && timeVal) {
    datetime_local = luxon.DateTime.fromISO(`${dateVal}T${timeVal}`, { zone: tz }).toISO();
  } else {
    datetime_local = luxon.DateTime.now().toISO();
  }

  const res = await fetch('/api/clock/in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id,
      note,
      datetime_local,
      timezone: tz
    })
  });
  const data = await res.json();
  if (data.success && data.session_id) {
    sessionID = data.session_id;
    localStorage.setItem('sessionID', sessionID);
  } else {
    sessionID = null;
    localStorage.removeItem('sessionID');
  }
  loadClockStatus();
}

async function clockOut() {
  if (!sessionID) return alert("No active session ID found, please reload or re-login.");
  const note = document.getElementById('noteOut').value;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Always get the values from the date/time fields (can be default or changed)
  let dateVal = document.getElementById('customDateOut').value;
  let timeVal = document.getElementById('customTimeOut').value;
  let datetime_local;

  if (dateVal && timeVal) {
    datetime_local = luxon.DateTime.fromISO(`${dateVal}T${timeVal}`, { zone: tz }).toISO();
  } else {
    datetime_local = luxon.DateTime.now().toISO();
  }

  await fetch('/api/clock/out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id: currentProject,
      note,
      datetime_local,
      timezone: tz,
      session_id: sessionID
    })
  });
  sessionID = null;
  localStorage.removeItem('sessionID');
  loadClockStatus();
}

function logout() {
  currentWorker = null;
  sessionID = null;
  localStorage.removeItem('sessionID');
  location.reload();
}

function showChangePassword() {
  let html = `<form id="pwForm">
    <div class="mb-2"><input class="form-control" type="password" id="oldPw" placeholder="Old Password"></div>
    <div class="mb-2"><input class="form-control" type="password" id="newPw" placeholder="New Password"></div>
    <button type="button" class="btn btn-primary" onclick="changePassword()">Change Password</button>
    <button type="button" class="btn btn-link" onclick="loadClockStatus()">Back</button>
    </form>`;
  document.getElementById('clock-status').innerHTML = html;
}

async function changePassword() {
  const oldPw = document.getElementById('oldPw').value;
  const newPw = document.getElementById('newPw').value;
  const res = await fetch('/api/worker/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id: currentWorker.worker_id, old_password: oldPw, new_password: newPw })
  });
  const data = await res.json();
  if (data.success) {
    alert("Password changed!");
    loadClockStatus();
  } else {
    alert(data.message || "Password change failed.");
  }
}
