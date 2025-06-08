const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper to get current pay rate for a worker
async function getPayRate(worker_id) {
  const q = await pool.query(
    "SELECT rate FROM pay_rates WHERE worker_id=$1 AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY start_date DESC LIMIT 1",
    [worker_id]
  );
  return q.rows[0]?.rate || 0;
}

// Worker clocks in
router.post('/in', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone } = req.body;
  try {
    const already = await pool.query(
      "SELECT * FROM clock_entries WHERE worker_id=$1 AND action='in' AND id NOT IN (SELECT in_entry.id FROM clock_entries as in_entry JOIN clock_entries as out_entry ON in_entry.worker_id=out_entry.worker_id AND in_entry.project_id=out_entry.project_id WHERE in_entry.action='in' AND out_entry.action='out' AND in_entry.id < out_entry.id)",
      [worker_id]
    );
    if (already.rows.length > 0) return res.status(400).json({ message: 'Already clocked in' });
    const pay_rate = await getPayRate(worker_id);
    await pool.query(
      `INSERT INTO clock_entries (worker_id, project_id, action, datetime_utc, datetime_local, timezone, note, pay_rate)
      VALUES ($1, $2, 'in', NOW(), $3, $4, $5, $6)`,
      [worker_id, project_id, datetime_local, timezone, note, pay_rate]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Worker clocks out
router.post('/out', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone } = req.body;
  try {
    await pool.query(
      `INSERT INTO clock_entries (worker_id, project_id, action, datetime_utc, datetime_local, timezone, note)
      VALUES ($1, $2, 'out', NOW(), $3, $4, $5)`,
      [worker_id, project_id, datetime_local, timezone, note]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get current clock status for worker (for frontend)
router.get('/status/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const q = await pool.query(
    `SELECT * FROM clock_entries WHERE worker_id=$1 ORDER BY datetime_utc DESC LIMIT 1`,
    [worker_id]
  );
  res.json(q.rows[0] || {});
});

// Admin force clock out
router.post('/force-out', async (req, res) => {
  const { worker_id, project_id, admin_name } = req.body;
  try {
    // Get the latest "in" entry for this worker/project that is still open
    const { rows } = await pool.query(
      `SELECT * FROM clock_entries
       WHERE worker_id=$1 AND project_id=$2 AND action='in'
       AND NOT EXISTS (
         SELECT 1 FROM clock_entries as out
         WHERE out.worker_id=$1 AND out.project_id=$2 AND out.action='out' AND out.datetime_local > clock_entries.datetime_local
       )
       ORDER BY datetime_local DESC
       LIMIT 1
      `, [worker_id, project_id]
    );
    if (!rows.length) return res.status(400).json({ message: "No active clock-in session found" });

    // Use the timezone from clock-in, and use NOW() for utc/local time
    const clockIn = rows[0];
    const nowUtc = new Date();
    // Generate local time string using clock-in's timezone (best effort in Node):
    const localTime = nowUtc.toLocaleString("sv-SE", { timeZone: clockIn.timezone }).replace(' ', 'T');
    await pool.query(
      `INSERT INTO clock_entries
         (worker_id, project_id, action, datetime_utc, datetime_local, timezone, note, admin_forced_by)
       VALUES
         ($1, $2, 'out', $3, $4, $5, $6, $7)`,
      [
        worker_id,
        project_id,
        nowUtc,
        localTime,
        clockIn.timezone,
        'Admin forced clock out',
        admin_name
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


module.exports = router;
