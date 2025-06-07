let currentWorker = null;
let currentProject = null;
let clockedIn = false;
let clockInTime = null; // add at top of file

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
  // Check if worker is clocked in
  const res = await fetch(`/api/clock/status/${currentWorker.worker_id}`);
  const lastEntry = await res.json();
  clockedIn = lastEntry && lastEntry.action === 'in';

  if (!clockedIn) {
    // Not clocked in: show project selection and clock in
    const projectRes = await fetch(`/api/worker/projects/${currentWorker.worker_id}`);
    const projects = await projectRes.json();
    let html = `<form id="clockInForm"><div class="mb-2"><label>Project:</label>`;
    for (const p of projects) {
      html += `<div class="form-check">
        <input class="form-check-input" type="radio" name="project" value="${p.id}" id="prj${p.id}">
        <label class="form-check-label" for="prj${p.id}">${p.name}</label>
      </div>`;
    }
    html += `</div>
      <div class="mb-2">
        <label>Notes:</label>
        <input class="form-control" id="note">
      </div>
      <button type="button" class="btn btn-success" onclick="clockIn()">Clock In</button>
      </form>
      <div class="mt-2">
        <button class="btn btn-link" onclick="showChangePassword()">Change Password</button>
      </div>`;
    document.getElementById('clock-status').innerHTML = html;
  } else {
    // Clocked in: show duration, clock-out form
    currentProject = lastEntry.project_id;
    let html = `<div class="mb-2">Clocked in to Project ID: <b>${lastEntry.project_id}</b> <br>
      Since: ${clockInTime.toLocaleString()}<br>
        <span id="clock-duration" class="fw-bold"></span>
      </div>
      <div class="mb-2">
        <label>Clock Out Note:</label>
        <input class="form-control" id="noteOut">
      </div>
      <button class="btn btn-danger" onclick="clockOut()">Clock Out</button>
      <div class="mt-2">
        <button class="btn btn-link" onclick="showChangePassword()">Change Password</button>
      </div>`;
    document.getElementById('clock-status').innerHTML = html;
    updateDuration(); // Start the timer
  }
}

// Duration updater
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
  await fetch('/api/clock/in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id,
      note,
      datetime_local: new Date().toISOString(),
      timezone: tz
    })
  });
  loadClockStatus();
}

async function clockOut() {
  const note = document.getElementById('noteOut').value;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await fetch('/api/clock/out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker_id: currentWorker.worker_id,
      project_id: currentProject,
      note,
      datetime_local: new Date().toISOString(),
      timezone: tz
    })
  });
  loadClockStatus();
}

function logout() {
  currentWorker = null;
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
