async function loadProjects() {
  const res = await fetch('/api/projects');
  const projects = await res.json();
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th>ID</th><th>Name</th><th>Location</th><th>City</th><th>Start Date</th><th>Finish Date</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (let p of projects) {
    html += `<tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.location || ''}</td>
      <td>${p.city || ''}</td>
      <td>${p.start_date || ''}</td>
      <td>${p.finish_date || ''}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="editProject(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})">Delete</button>
      </td>
    </tr>`;
  }
  html += `</tbody></table>
  <button class="btn btn-success" onclick="showAddForm()">Add Project</button>
  <div id="project-form"></div>`;
  document.getElementById('project-admin-section').innerHTML = html;
}

function showAddForm() {
  let html = `<form id="addPrjForm" class="mt-3">
    <input class="form-control mb-2" id="prjName" placeholder="Project Name">
    <input class="form-control mb-2" id="prjLoc" placeholder="Location">
    <input class="form-control mb-2" id="prjCity" placeholder="City">
    <input class="form-control mb-2" type="date" id="prjStart">
    <input class="form-control mb-2" type="date" id="prjFinish">
    <button type="button" class="btn btn-primary" onclick="addProject()">Add</button>
    <button type="button" class="btn btn-link" onclick="loadProjects()">Cancel</button>
  </form>`;
  document.getElementById('project-form').innerHTML = html;
}

async function addProject() {
  function emptyToNull(val) { return val && val.trim() ? val : null; }
  const body = {
    name: document.getElementById('prjName').value,
    location: document.getElementById('prjLoc').value,
    city: document.getElementById('prjCity').value,
    start_date: document.getElementById('prjStart').value,
    finish_date: document.getElementById('prjFinish').value
  };
  await fetch('/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
   if (!resp.ok) {
    alert("Add failed: " + (await resp.text()));
  }
  loadProjects();
}

function editProject(id) {
  // For brevity: fetch the project info, show form to edit, submit to PUT /api/projects/:id
  alert('Edit project functionality: expand here!');
}

async function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  await fetch('/api/projects/' + id, { method: 'DELETE' });
  loadProjects();
}

window.onload = loadProjects;
