let currentWorker = null;
let currentProject = null;
let sessionID = null;
let clockedIn = false;
let clockInTime = null;

// Restore sessionID if present in localStorage
if (localStorage.getItem('sessionID')) {
  sessionID = localStorage.getItem('sessionID');
}

function getCurrentDateAndTime() {
  const now = luxon.DateTime.now();
  return {
    date: now.toFormat('yyyy-MM-dd'),
    time: now.toFormat('HH:mm'),
    offset: now.offset // in minutes
  };
}

// For updating clock every minute on form fields
let clockInterval;
function startClockUpdater() {
  if (clockInterval) clearInterval(clockInterval);
  function updateClockFields() {
    const { date, time } = getCurrentDateAndTime();
    if (document.getElementById('customDate')) document.getElementById('customDate').value = date;
    if (document.getElementById('customTime')) document.getElementById('customTime').value = time;
    if (document.getElementById('customDateOut')) document.getElementById('customDateOut').value = date;
    if (document.getElementById('customTimeOut')) document.getElementById('customTimeOut').value = time;
  }
  updateClockFields();
  clockInterval = setInterval(updateClockFields, 60 * 1000);
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
    const projectRes = await fetch(`/api/worker/projects/${currentWorker.worker_id}`);
    const projects = await projectRes.json();

    const { date, time } = getCurrentDateAndTime();

    let html = `<form id="clockInForm"><div class="mb-2"><label>Project:</label>`;
    for (const p of projects) {
      html += `<div class="form-check">
        <input class="form-check-input" type="radio" name="project" value="${p.id}" id="prj${p.id}">
        <label class="form-check-label" for="prj${p.id}">${p.name}</label>
      </div>`;
    }
    html += `</div>
      <div class="mb-2">
        <label>Date:</label>
        <input type="date" class="form-control" id="customDate" value="${date}">
      </div>
      <div class="mb-2">
        <label>Time:</label>
        <input type="time" class="form-control" id="customTime" step="60" value="${time}">
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
    startClockUpdater();
  } else {
    currentProject = lastEntry.project_id;
    sessionID = lastEntry.session_id;
    localStorage.setItem('sessionID', sessionID);
    clockInTime = new Date(lastEntry.datetime_local);

    const { date, time } = getCurrentDateAndTime();

    let html = `<div class="mb-2">Clocked in to Project ID: <b>${lastEntry.project_id}</b> <br>
      Since: ${clockInTime.toLocaleString()}<br>
      <span id="clock-duration" class="fw-bold"></span>
      </div>
      <form id="clockOutForm">
      <div class="mb-2">
        <label>Date:</label>
        <input type="date" class="form-control" id="customDateOut" value="${date}">
      </div>
      <div class="mb-2">
        <label>Time:</label>
        <input type="time" class="form-control" id="customTimeOut" step="60" value="${time}">
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
    startClockUpdater();
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

function getLocalDateTimeAndOffset(dateFieldId, timeFieldId) {
  const dateVal = document.getElementById(dateFieldId).value;
  const timeVal = document.getElementById(timeFieldId).value;
  let dt;
  if (dateVal && timeVal) {
    dt = luxon.DateTime.fromISO(`${dateVal}T${timeVal}`);
  } else {
    dt = luxon.DateTime.now();
  }
  return {
    datetime_local: dt.toFormat("yyyy-MM-dd'T'HH:mm"),
    timezone_offset: dt.offset // in minutes, e.g. -420 for PDT
  };
}

async function clockIn() {
  const project_id = document.querySelector('input[name="project"]:checked')?.value;
  if (!project_id) return alert("Please select a project.");
  const note = document.getElementById('note').value;
  const { datetime_local, timezone_offset } = getLocalDateTimeAndOffset('customDate', 'customTime');
  const res = await fetch('/api/clock/in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id,
      note,
      datetime_local,
      timezone_offset
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
  const { datetime_local, timezone_offset } = getLocalDateTimeAndOffset('customDateOut', 'customTimeOut');
  await fetch('/api/clock/out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id: currentProject,
      note,
      datetime_local,
      timezone_offset,
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
