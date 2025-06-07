async function loadPayroll() {
  const res = await fetch('/api/payroll/unbilled');
  const rows = await res.json();
  let html = `<table class="table table-bordered table-sm">
    <thead><tr>
      <th>Worker</th><th>Project</th><th>Action</th><th>UTC</th><th>Local</th><th>Note</th><th>Pay Rate</th>
    </tr></thead><tbody>`;
  for (let r of rows) {
    html += `<tr>
      <td>${r.worker_name}</td>
      <td>${r.project_name}</td>
      <td>${r.action}</td>
      <td>${r.datetime_utc}</td>
      <td>${r.datetime_local ? new Date(r.datetime_local).toLocaleString() : ''}</td>
      <td>${r.note || ''}</td>
      <td>${r.pay_rate || ''}</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  document.getElementById('payroll-section').innerHTML = html;
}

async function exportCSV() {
  window.open('/api/payroll/export', '_blank');
}

window.onload = loadPayroll;
