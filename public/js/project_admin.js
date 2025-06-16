// project_admin.js

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(await res.text());
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
  } catch (err) {
    document.getElementById('project-admin-section').innerHTML = `<div class="alert alert-danger">Error loading projects: ${err.message}</div>`;
  }
}

function showAddForm() {
  let html = `<form id="addPrjForm" class="mt-3">
    <input class="form-control mb-2" id="prjName" placeholder="Project Name">
    <input class="form-control mb-2" id="prjLoc" placeholder="Location">
    <input class="form-control mb-2" id="prjCity" placeholder="City">
    <input class="form-control mb-2" type="text" id="prjStart" placeholder="Start Date (YYYY-MM-DD)">
    <input class="form-control mb-2" type="text" id="prjFinish" placeholder="Finish Date (YYYY-MM-DD)">
    <button type="button" class="btn btn-primary" onclick="addProject()">Add</button>
    <button type="button" class="btn btn-link" onclick="loadProjects()">Cancel</button>
  </form>`;
  document.getElementById('project-form').innerHTML = html;
}

async function addProject() {
  const body = {
    name: document.getElementById('prjName').value,
    location: document.getElementById('prjLoc').value,
    city: document.getElementById('prjCity').value,
    start_date: document.getElementById('prjStart').value,
    finish_date: document.getElementById('prjFinish').value
  };
  const resp = await fetch('/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    alert("Add failed: " + (await resp.text()));
  }
  loadProjects();
}

async function editProject(id) {
  // Fetch all projects, find the one to edit
  const res = await fetch(`/api/projects`);
  if (!res.ok) {
    alert('Cannot fetch projects to edit.');
    return;
  }
  const projects = await res.json();
  const p = projects.find(proj => proj.id === id);
  if (!p) {
    alert("Project not found!");
    return;
  }
  let html = `<form id="editPrjForm" class="mt-3">
    <input class="form-control mb-2" id="prjName" placeholder="Project Name" value="${p.name}">
    <input class="form-control mb-2" id="prjLoc" placeholder="Location" value="${p.location || ''}">
    <input class="form-control mb-2" id="prjCity" placeholder="City" value="${p.city || ''}">
    <input class="form-control mb-2" type="text" id="prjStart" placeholder="Start Date (YYYY-MM-DD)" value="${p.start_date || ''}">
    <input class="form-control mb-2" type="text" id="prjFinish" placeholder="Finish Date (YYYY-MM-DD)" value="${p.finish_date || ''}">
    <button type="button" class="btn btn-primary" onclick="updateProject(${id})">Update</button>
    <button type="button" class="btn btn-link" onclick="loadProjects()">Cancel</button>
  </form>`;
  document.getElementById('project-form').innerHTML = html;
}

async function updateProject(id) {
  const body = {
    name: document.getElementById('prjName').value,
    location: document.getElementById('prjLoc').value,
    city: document.getElementById('prjCity').value,
    start_date: document.getElementById('prjStart').value,
    finish_date: document.getElementById('prjFinish').value
  };
  const resp = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    alert("Update failed: " + (await resp.text()));
    return;
  }
  loadProjects();
}

async function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  const resp = await fetch('/api/projects/' + id, { method: 'DELETE' });
  if (!resp.ok) {
    alert("Delete failed: " + (await resp.text()));
    return;
  }
  loadProjects();
}

window.onload = loadProjects;
