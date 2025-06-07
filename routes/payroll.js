const express = require('express');
const router = express.Router();
const pool = require('../db');

// List all unbilled sections (for payroll)
router.get('/unbilled', async (req, res) => {
  const q = await pool.query(
    `SELECT ce.*, w.name as worker_name, p.name as project_name
     FROM clock_entries ce
     JOIN workers w ON ce.worker_id = w.worker_id
     JOIN projects p ON ce.project_id = p.id
     WHERE ce.billed IS FALSE OR ce.billed IS NULL
     ORDER BY ce.datetime_utc DESC`
  );
  res.json(q.rows);
});

// Mark entries as billed
router.post('/bill', async (req, res) => {
  const { entry_ids, billed_date } = req.body;
  await pool.query(
    `UPDATE clock_entries SET billed=TRUE, billed_date=$1 WHERE id = ANY($2::int[])`,
    [billed_date, entry_ids]
  );
  res.json({ success: true });
});

// Mark entries as paid
router.post('/paid', async (req, res) => {
  const { entry_ids, paid_date } = req.body;
  await pool.query(
    `UPDATE clock_entries SET paid=TRUE, paid_date=$1 WHERE id = ANY($2::int[])`,
    [paid_date, entry_ids]
  );
  res.json({ success: true });
});

// Export to CSV
router.get('/export', async (req, res) => {
  const q = await pool.query(
    `SELECT ce.*, w.name as worker_name, p.name as project_name
     FROM clock_entries ce
     JOIN workers w ON ce.worker_id = w.worker_id
     JOIN projects p ON ce.project_id = p.id
     WHERE ce.billed IS FALSE OR ce.billed IS NULL
     ORDER BY ce.datetime_utc DESC`
  );
  let csv = 'ID,Worker,Project,Clock In/Out,UTC,Local,Timezone,Note,Pay Rate\n';
  for (let row of q.rows) {
    csv += `${row.id},"${row.worker_name}","${row.project_name}","${row.action}",${row.datetime_utc},${row.datetime_local},${row.timezone},"${row.note}",${row.pay_rate}\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=unbilled_${Date.now()}.csv`);
  res.send(csv);
});

module.exports = router;
