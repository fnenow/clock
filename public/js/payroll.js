let filters = {
  start_date: "",
  end_date: "",
  worker_id: "",
  project_id: "",
  billed: "",
  paid: ""
};

async function loadWorkersAndProjects() {
  // Populate worker and project dropdowns
  const [workersRes, projectsRes] = await Promise.all([
    fetch('/api/worker/all'),  // your /routes/worker.js should have router.get('/all')
    fetch('/api/projects')     // your /routes/project.js should have router.get('/')
  ]);
  const workers = await workersRes.json();
  const projects = await projectsRes.json();

  let wOpt = '<option value="">All</option>';
  workers.forEach(w => wOpt += `<option value="${w.worker_id}">${w.name}</option>`);
  document.getElementById('filter-worker').innerHTML = wOpt;

  let pOpt = '<option value="">All</option>';
  projects.forEach(p => pOpt += `<option value="${p.id}">${p.name}</option>`);
  document.getElementById('filter-project').innerHTML = pOpt;
}

function getFilterValues() {
  return {
    start_date: document.getElementById('filter-start').value,
    end_date: document.getElementById('filter-end').value,
    worker_id: document.getElementById('filter-worker').value,
    project_id: document.getElementById('filter-project').value,
    billed: document.getElementById('filter-billed').value,
    paid: document.getElementById('filter-paid').value
  };
}

async function loadPayroll() {
  filters = getFilterValues();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
  const res = await fetch('/api/payroll?' + params.toString());
  const { rows, workerSums } = await res.json();
  renderPayrollSummary(workerSums);
  renderPayrollTable(rows);
}

function renderPayrollSummary(workerSums) {
  if (!workerSums.length) {
    document.getElementById('payroll-summary').innerHTML = '';
    return;
  }
  let html = `<h5>Period Summary</h5>
  <table class="table table-bordered table-sm mb-4"><thead>
    <tr><th>Worker</th><th>Regular Hours</th><th>OT Hours</th><th>Amount</th></tr>
  </thead><tbody>`;
  workerSums.forEach(w =>
    html += `<tr>
      <td>${w.worker_name}</td>
      <td>${w.regular_time.toFixed(2)}</td>
      <td>${w.overtime.toFixed(2)}</td>
      <td>$${w.pay_amount.toFixed(2)}</td>
    </tr>`);
  html += '</tbody></table>';
  document.getElementById('payroll-summary').innerHTML = html;
}

function renderPayrollTable(rows) {
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th><input type="checkbox" id="check-all" onchange="toggleAllChecks(this)"></th>
      <th>Worker</th><th>Project</th>
      <th>In</th><th>Out</th>
      <th>Regular Hours</th><th>OT Hours</th><th>OT Type</th>
      <th>Pay Rate</th><th>Amount</th>
      <th>Bill Date</th><th>Paid Date</th><th>Note</th>
    </tr></thead><tbody>`;
  for (let r of rows) {
    html += `<tr>
      <td><input type="checkbox" class="payroll-check" value="${r.id}"></td>
      <td>${r.worker_name}</td>
      <td>${r.project_name}</td>
      <td>${r.datetime_local || ''}</td>
      <td>${r.datetime_out_local || ''}</td>
      <td>${Number(r.regular_time || 0).toFixed(2)}</td>
      <td>${Number(r.overtime || 0).toFixed(2)}</td>
      <td>${r.ot_type || ''}</td>
      <td>${r.pay_rate ? Number(r.pay_rate).toFixed(2) : ''}</td>
      <td>${r.pay_amount ? Number(r.pay_amount).toFixed(2) : ''}</td>
      <td>${r.billed_date || ''}</td>
      <td>${r.paid_date || ''}</td>
      <td>${r.note || ''}</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  document.getElementById('payroll-table').innerHTML = html;
}

function toggleAllChecks(source) {
  document.querySelectorAll('.payroll-check').forEach(cb => cb.checked = source.checked);
}

async function billSelected() {
  const ids = Array.from(document.querySelectorAll('.payroll-check:checked')).map(cb => Number(cb.value));
  if (!ids.length) return alert('No entries selected.');
  const billed_date = prompt('Enter Bill Date (any format):');
  if (!billed_date) return;
  await fetch('/api/payroll/bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: ids, billed_date })
  });
  loadPayroll();
}

async function paidSelected() {
  const ids = Array.from(document.querySelectorAll('.payroll-check:checked')).map(cb => Number(cb.value));
  if (!ids.length) return alert('No entries selected.');
  const paid_date = prompt('Enter Paid Date (any format):');
  if (!paid_date) return;
  await fetch('/api/payroll/paid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: ids, paid_date })
  });
  loadPayroll();
}

function exportCSV() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
  window.open('/api/payroll/export?' + params.toString(), '_blank');
}

window.onload = async function () {
  await loadWorkersAndProjects();
  document.getElementById('filter-btn').onclick = loadPayroll;
  loadPayroll();
};
