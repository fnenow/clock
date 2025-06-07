let adminSession = null;

async function adminLogin() {
  const username = document.getElementById('adminUser').value;
  const password = document.getElementById('adminPass').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    adminSession = data.username;
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = '';
    showClockedIn();
  } else {
    alert(data.message || "Login failed");
  }
}

async function showClockedIn() {
  const res = await fetch('/api/admin/clocking-in');
  const rows = await res.json();
  renderAdminTable(rows, false);
}

async function showClockedOut() {
  const res = await fetch('/api/admin/clocked-out');
  const rows = await res.json();
  renderAdminTable(rows, true);
}

function renderAdminTable(rows, isOut) {
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th>Worker</th><th>Project</th>
      <th>Clock In</th><th>Clock Out</th>
      <th>Duration</th>
      <th>Clock In Note</th><th>Clock Out Note</th>
      <th>Pay Rate</th>
      <th>Admin Forced By</th>
    </tr></thead><tbody>`;
  for (let r of rows) {
    // Duration formatting
    let duration = '';
    if (r.duration_sec !== undefined && r.duration_sec !== null) {
      const sec = Math.floor(r.duration_sec % 60);
      const min = Math.floor((r.duration_sec / 60) % 60);
      const hr = Math.floor(r.duration_sec / 3600);
      duration = `${hr}h ${min}m ${sec}s`;
    }
    html += `<tr>
      <td>${r.worker_name}</td>
      <td>${r.project_name}</td>
      <td>${r.clock_in_time ? new Date(r.clock_in_time).toLocaleString() : ''}</td>
      <td>${r.clock_out_time ? new Date(r.clock_out_time).toLocaleString() : ''}</td>
      <td>${duration}</td>
      <td>${r.in_note || ''}</td>
      <td>${r.out_note || ''}</td>
      <td>${r.pay_rate || ''}</td>
      <td>${r.admin_forced_by || ''}</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  document.getElementById('admin-table').innerHTML = html;
}

// Live duration timer for admin dashboard
function startDurationTimer(spanId, startTime) {
  const el = document.getElementById(spanId);
  if (!el) return;
  const clockIn = new Date(startTime);
  function update() {
    const now = new Date();
    const diff = now - clockIn;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${h}h ${m}m ${s}s`;
    setTimeout(update, 1000);
  }
  update();
}

async function forceOut(worker_id, project_id) {
  const admin_name = adminSession;
  if (!confirm("Force clock out this worker?")) return;
  await fetch('/api/clock/force-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id, project_id, admin_name })
  });
  showClockedIn();
}

function logout() {
  adminSession = null;
  location.reload();
}
