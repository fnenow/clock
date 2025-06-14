async function loadWorkers() {
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
        <button class="btn btn-sm btn-info" onclick="showWorkerForm(true, '${w.worker_id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWorker('${w.worker_id}')">Delete</button>
      </td>
    </tr>`;
  }
  html += `</tbody></table>
    <button class="btn btn-success" onclick="showWorkerForm(false)">Add Worker</button>
    <div id="worker-form"></div>`;
  document.getElementById('worker-admin-section').innerHTML = html;
}

async function showWorkerForm(edit, worker_id) {
  let worker = {};
  if (edit) {
    worker = (await fetch('/api/worker/list').then(r => r.json())).find(w => w.worker_id === worker_id) || {};
  }
  let projects = await fetch('/api/projects').then(r => r.json());
  let assignedProjects = [];
  if (edit && worker_id) {
    assignedProjects = await fetch(`/api/worker/projects/${worker_id}`).then(r => r.json());
    assignedProjects = assignedProjects.map(p => p.id);
  }
  let projectCheckboxes = projects.map(p => `
    <div>
      <input type="checkbox" id="prj_${p.id}" value="${p.id}" ${assignedProjects.includes(p.id) ? 'checked' : ''}>
      <label for="prj_${p.id}">${p.name}</label>
    </div>
  `).join('');
  document.getElementById('worker-form').innerHTML = `
    <form id="workerForm" class="mt-3">
      <input class="form-control mb-2" id="wName" placeholder="Name" value="${worker?.name || ''}" required>
      <input class="form-control mb-2" id="wPhone" placeholder="Phone" value="${worker?.phone || ''}" required>
      <input class="form-control mb-2" id="wStart" type="date" value="${worker?.start_date ? worker.start_date.substring(0,10) : ''}" required>
      <input class="form-control mb-2" id="wEnd" type="date" value="${worker?.end_date ? worker.end_date.substring(0,10) : ''}">
      <input class="form-control mb-2" id="wNote" placeholder="Note" value="${worker?.note || ''}">
      <input class="form-control mb-2" id="wWorkerId" placeholder="Worker ID (auto last 5 digits, change if needed)" value="${worker?.worker_id || ''}" ${edit ? "readonly" : ""}>
      <div class="form-check mb-2">
        <input type="checkbox" id="wInactive" class="form-check-input" ${worker?.inactive ? 'checked' : ''}>
        <label for="wInactive" class="form-check-label">Inactive</label>
      </div>
      <div class="mb-2"><b>Assign Projects:</b>${projectCheckboxes}</div>
      <button type="button" class="btn btn-primary" onclick="${edit ? `updateWorker('${worker.worker_id}')` : 'addWorker()'}">${edit ? 'Update' : 'Add'}</button>
      <button type="button" class="btn btn-link" onclick="loadWorkers()">Cancel</button>
    </form>
  `;
}

async function addWorker() {
  const body = {
    name: document.getElementById('wName').value,
    phone: document.getElementById('wPhone').value,
    start_date: document.getElementById('wStart').value,
    note: document.getElementById('wNote').value,
    worker_id: document.getElementById('wWorkerId').value || undefined,
    end_date: document.getElementById('wEnd').value,
    inactive: document.getElementById('wInactive').checked
  };
  let resp = await fetch('/api/worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    alert("Error: " + (await resp.text()));
    return;
  }
  const { worker_id } = await resp.json();
  await assignProjects(worker_id);
  loadWorkers();
}

async function updateWorker(worker_id) {
  const body = {
    name: document.getElementById('wName').value,
    phone: document.getElementById('wPhone').value,
    start_date: document.getElementById('wStart').value,
    end_date: document.getElementById('wEnd').value,
    note: document.getElementById('wNote').value,
    inactive: document.getElementById('wInactive').checked
  };
  let resp = await fetch('/api/worker/' + worker_id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    alert("Error: " + (await resp.text()));
    return;
  }
  await assignProjects(worker_id);
  loadWorkers();
}

async function deleteWorker(worker_id) {
  if (!confirm("Delete this worker?")) return;
  await fetch('/api/worker/' + worker_id, { method: 'DELETE' });
  loadWorkers();
}

async function assignProjects(worker_id) {
  let checkboxes = document.querySelectorAll('[id^="prj_"]');
  for (let cb of checkboxes) {
    let project_id = cb.value;
    let checked = cb.checked;
    await fetch(`/api/worker/${worker_id}/${checked ? 'assign' : 'unassign'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id })
    });
  }
}

window.onload = loadWorkers;
