async function loadPayrates() {
  // For demo: get all workers and their current payrates
  const res = await fetch('/api/worker/list');
  const workers = await res.json();
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th>Worker</th><th>Current Rate</th><th>History</th><th>Add Rate</th></tr></thead><tbody>`;
  for (let w of workers) {
    html += `<tr>
      <td>${w.name} (${w.worker_id})</td>
      <td id="currentRate${w.worker_id}"></td>
      <td><button class="btn btn-sm btn-info" onclick="showHistory('${w.worker_id}')">View</button></td>
      <td>
        <input id="newRate${w.worker_id}" style="width:80px" type="number" min="0">
        <button class="btn btn-sm btn-success" onclick="addRate('${w.worker_id}')">Add</button>
      </td>
    </tr>`;
  }
  html += `</tbody></table>
    <div id="rate-history-modal"></div>`;
  document.getElementById('payrate-admin-section').innerHTML = html;
  for (let w of workers) {
    const cr = await fetch(`/api/payrate/current/${w.worker_id}`);
    const r = await cr.json();
    document.getElementById('currentRate' + w.worker_id).textContent = r.rate || '';
  }
}

async function showHistory(worker_id) {
  const res = await fetch(`/api/payrate/history/${worker_id}`);
  const rates = await res.json();
  let html = `<div class="modal" style="display:block; background:rgba(0,0,0,0.5)">
    <div class="modal-dialog"><div class="modal-content"><div class="modal-header">
      <h5 class="modal-title">Rate History for ${worker_id}</h5>
      <button type="button" class="btn-close" onclick="closeModal()"></button>
      </div>
      <div class="modal-body"><ul>`;
  for (let r of rates) {
    html += `<li>${r.rate} - ${r.start_date ? r.start_date.substring(0, 10) : ""}</li>`;
  }
  html += `</ul></div></div></div></div>`;
  document.getElementById('rate-history-modal').innerHTML = html;
}

function closeModal() {
  document.getElementById('rate-history-modal').innerHTML = "";
}

async function addRate(worker_id) {
  const rate = document.getElementById('newRate' + worker_id).value;
  if (!rate) return alert('Enter a rate.');
  await fetch('/api/payrate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id, rate, start_date: new Date().toISOString().substring(0,10) })
  });
  loadPayrates();
}

window.onload = loadPayrates;
