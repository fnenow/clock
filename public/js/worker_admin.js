async function loadWorkers() {
  // (For demo: get all workers via /api/worker or /api/worker/list -- implement as needed)
  // Let's mock with only one user for now
  const res = await fetch('/api/worker/list');
  const workers = await res.json();
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th>ID</th><th>Name</th><th>Phone</th><th>Start</th><th>End</th><th>Inactive</th><th>Note</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (let w of workers) {
    html += `<tr>
      <td>${w.worker_id}</td>
      <td>${w.name}</td>
      <td>${w.phone}</td>
      <td>${w.start_date ? w.start_date.substring(0, 10) : ''}</td>
      <td>${w.end_date ? w.end_date.substring(0, 10) : ''}</td>
      <td>${w.inactive ? "Yes" : ""}</td>
      <td>${w.note || ""}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="editWorker('${w.worker_id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWorker('${w.worker_id}')">Delete</button>
      </td>
    </tr>`;
  }
  html += `</tbody></table>
    <button class="btn btn-success" onclick="showAddForm()">Add Worker</button>
    <div id="worker-form"></div>`;
  document.getElementById('worker-admin-section').innerHTML = html;
}

function showAddForm() {
  let html = `<form id="addWorkerForm" class="mt-3">
    <input class="form-control mb-2" id="wName" placeholder="Name" required>
    <input class="form-control mb-2" id="wPhone" placeholder="Phone" required>
    <input class="form-control mb-2" type="date" id="wStart" required>
    <input class="form-control mb-2" id="wNote" placeholder="Note">
    <button type="button" class="btn btn-primary" onclick="addWorker()">Add</button>
    <button type="button" class="btn btn-link" onclick="loadWorkers()">Cancel</button>
  </form>`;
  document.getElementById('worker-form').innerHTML = html;
}

async function addWorker() {
  const body = {
    name: document.getElementById('wName').value,
    phone: document.getElementById('wPhone').value,
    start_date: document.getElementById('wStart').value,
    note: document.getElementById('wNote').value
  };
  await fetch('/api/worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  loadWorkers();
}

function editWorker(worker_id) {
  // For brevity, just show a modal or form to edit and call PUT /api/worker/:worker_id
  alert('Edit worker functionality: expand here!');
}

async function deleteWorker(worker_id) {
  if (!confirm("Delete this worker?")) return;
  await fetch('/api/worker/' + worker_id, { method: 'DELETE' });
  loadWorkers();
}

window.onload = loadWorkers;
