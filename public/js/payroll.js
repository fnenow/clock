// /public/js/payroll.js
const API_URL = '/api/payroll';
let payrollData = [];
let filters = {
  start_date: '',
  end_date: '',
  worker_id: '',
  project_id: '',
  billed: 'false', // default: unbilled only
  paid: ''
};

// ========== UI INIT ========== //
window.onload = async () => {
  await loadFilterOptions();
  await loadPayroll();
  bindFilterEvents();
  document.getElementById('btn-bill').onclick = markAsBilled;
  document.getElementById('btn-paid').onclick = markAsPaid;
  document.getElementById('btn-export').onclick = exportCSV;
};

async function loadFilterOptions() {
  // Load workers
  let res = await fetch('/api/worker/all');
  let workers = await res.json();
  let workerSel = document.getElementById('filter-worker');
  workerSel.innerHTML = `<option value="">All Workers</option>`;
  workers.forEach(w => workerSel.innerHTML += `<option value="${w.worker_id}">${w.name}</option>`);
  // Load projects
  res = await fetch('/api/projects');
  let projects = await res.json();
  let projSel = document.getElementById('filter-project');
  projSel.innerHTML = `<option value="">All Projects</option>`;
  projects.forEach(p => projSel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
}

function bindFilterEvents() {
  // On change of any filter, reload payroll
  ['filter-start', 'filter-end', 'filter-worker', 'filter-project', 'filter-billed', 'filter-paid'].forEach(id => {
    document.getElementById(id).onchange = loadPayroll;
  });
  document.getElementById('btn-clear').onclick = () => {
    filters = { start_date:'', end_date:'', worker_id:'', project_id:'', billed:'false', paid:'' };
    document.getElementById('filter-form').reset();
    loadPayroll();
  }
}

// ========== DATA LOADING ========== //
async function loadPayroll() {
  // Collect filter values
  filters.start_date = document.getElementById('filter-start').value;
  filters.end_date   = document.getElementById('filter-end').value;
  filters.worker_id  = document.getElementById('filter-worker').value;
  filters.project_id = document.getElementById('filter-project').value;
  filters.billed     = document.getElementById('filter-billed').value;
  filters.paid       = document.getElementById('filter-paid').value;

  // Build query params
  let params = [];
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  let url = `${API_URL}?${params.join('&')}`;

  // Fetch data
  let res = await fetch(url);
  payrollData = await res.json();

  renderPayrollTable();
}

function renderPayrollTable() {
  let tbody = '';
  payrollData.forEach(row => {
    tbody += `<tr>
      <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
      <td>${row.worker_name}</td>
      <td>${row.project_name}</td>
      <td>${formatDate(row.datetime_local)}</td>
      <td>${formatDate(row.datetime_out_local)}</td>
      <td>${row.regular_time || ''}</td>
      <td>${row.overtime || ''}</td>
      <td>${row.ot_type ? row.ot_type.toUpperCase() : ''}</td>
      <td>${fmtCurrency(row.pay_rate)}</td>
      <td>${fmtCurrency(row.pay_amount)}</td>
      <td>${row.billed_date ? formatDate(row.billed_date) : ''}</td>
      <td>${row.paid_date ? formatDate(row.paid_date) : ''}</td>
    </tr>`;
  });

  document.getElementById('payroll-tbody').innerHTML = tbody;
}

// ========== ACTIONS ========== //
function getSelectedIds() {
  return Array.from(document.querySelectorAll('.row-check:checked'))
    .map(cb => parseInt(cb.dataset.id));
}

async function markAsBilled() {
  let ids = getSelectedIds();
  if (!ids.length) return alert('Select rows to bill.');
  let billed_date = prompt('Enter Bill Date (YYYY-MM-DD):', (new Date()).toISOString().slice(0,10));
  if (!billed_date) return;
  await fetch(`${API_URL}/bill`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ entry_ids: ids, billed_date })
  });
  await loadPayroll();
}

async function markAsPaid() {
  let ids = getSelectedIds();
  if (!ids.length) return alert('Select rows to mark as paid.');
  let paid_date = prompt('Enter Paid Date (YYYY-MM-DD):', (new Date()).toISOString().slice(0,10));
  if (!paid_date) return;
  await fetch(`${API_URL}/paid`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ entry_ids: ids, paid_date })
  });
  await loadPayroll();
}

function exportCSV() {
  // Build query string with current filters
  let params = [];
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  let url = `${API_URL}/export?${params.join('&')}`;
  window.open(url, '_blank');
}

// ========== HELPERS ========== //
function formatDate(str) {
  if (!str) return '';
  let d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleString('en-US', {year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
}

function fmtCurrency(v) {
  if (v == null || v === '') return '';
  return '$' + parseFloat(v).toFixed(2);
}

