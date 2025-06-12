const express = require('express');
const router = express.Router();
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

// Helper: Get current pay rate for worker
async function getPayRate(worker_id) {
  const q = await pool.query(
    "SELECT rate FROM pay_rates WHERE worker_id=$1 AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY start_date DESC LIMIT 1",
    [worker_id]
  );
  return q.rows[0]?.rate || 0;
}

// Native JS: Parse datetime_local (YYYY-MM-DDTHH:mm) to Date, subtract offset to get UTC
function parseToUTC(datetime_local, timezone_offset) {
  const [date, time] = datetime_local.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Create local time as if it were UTC
  const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Subtract the offset to get UTC
  const utcMs = localDate.getTime() - timezone_offset * 60 * 1000;
  const utcDate = new Date(utcMs);

  // Return as "YYYY-MM-DDTHH:mm"
  const isoUTC = utcDate.toISOString().slice(0, 16);
  const isoLocal = localDate.toISOString().slice(0, 16);
  return {
    datetime_utc: isoUTC,
    datetime_local: isoLocal
  };
}

// CLOCK IN
router.post('/in', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone_offset } = req.body;
  try {
    const already = await pool.query(
      `SELECT * FROM clock_entries
       WHERE worker_id=$1 AND project_id=$2 AND action='in'
       AND NOT EXISTS (
         SELECT 1 FROM clock_entries AS out
         WHERE out.worker_id=$1 AND out.project_id=$2 AND out.action='out' AND out.datetime_local > clock_entries.datetime_local
       )`,
      [worker_id, project_id]
    );
    if (already.rows.length > 0)
      return res.status(400).json({ message: 'Already clocked in to this project' });

    const pay_rate = await getPayRate(worker_id);
    const session_id = uuidv4();

    // Convert to UTC
    const { datetime_utc } = parseToUTC(datetime_local, timezone_offset);

    await pool.query(
      `INSERT INTO clock_entries 
        (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, pay_rate, session_id)
       VALUES 
        ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
      [
        worker_id,
        project_id,
        datetime_utc,   // UTC (YYYY-MM-DDTHH:mm)
        datetime_local, // as received
        timezone_offset,
        note,
        pay_rate,
        session_id
      ]
    );
    res.json({ success: true, session_id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CLOCK OUT
router.post('/out', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone_offset, session_id } = req.body;
  try {
    if (!session_id) return res.status(400).json({ message: "Missing session_id" });

    const { rows } = await pool.query(
      `SELECT * FROM clock_entries WHERE worker_id=$1 AND project_id=$2 AND session_id=$3 AND action='in'
       AND NOT EXISTS (
         SELECT 1 FROM clock_entries AS out
         WHERE out.session_id=$3 AND out.action='out'
       )`,
      [worker_id, project_id, session_id]
    );
    if (!rows.length) return res.status(400).json({ message: "No matching open clock-in session found" });

    const { datetime_utc } = parseToUTC(datetime_local, timezone_offset);

    await pool.query(
      `INSERT INTO clock_entries 
        (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, session_id)
       VALUES 
        ($1, $2, 'out', $3, $4, $5, $6, $7)`,
      [
        worker_id,
        project_id,
        datetime_utc,
        datetime_local,
        timezone_offset,
        note,
        session_id
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET CURRENT CLOCK STATUS
router.get('/status/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const q = await pool.query(
    `SELECT * FROM clock_entries
     WHERE worker_id=$1 AND action='in'
     AND NOT EXISTS (
       SELECT 1 FROM clock_entries AS out
       WHERE out.worker_id=$1 AND out.project_id=clock_entries.project_id AND out.session_id=clock_entries.session_id AND out.action='out'
     )
     ORDER BY datetime_utc DESC LIMIT 1`,
    [worker_id]
  );
  res.json(q.rows[0] || {});
});

// ADMIN FORCE CLOCK OUT (optional, use UTC now)
router.post('/force-out', async (req, res) => {
  const { worker_id, project_id, admin_name } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clock_entries
       WHERE worker_id=$1 AND project_id=$2 AND action='in'
       AND NOT EXISTS (
         SELECT 1 FROM clock_entries AS out
         WHERE out.worker_id=$1 AND out.project_id=$2 AND out.session_id=clock_entries.session_id AND out.action='out'
       )
       ORDER BY datetime_local DESC
       LIMIT 1
      `, [worker_id, project_id]
    );
    if (!rows.length) return res.status(400).json({ message: "No active clock-in session found" });

    const clockIn = rows[0];
    const now = new Date();
    const utcNow = now.toISOString().slice(0, 16);
    // Calculate "local" as UTC + offset, if you want to
    const localNow = new Date(now.getTime() + clockIn.timezone_offset * 60 * 1000)
      .toISOString().slice(0, 16);

    await pool.query(
      `INSERT INTO clock_entries
         (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, admin_forced_by, session_id)
       VALUES
         ($1, $2, 'out', $3, $4, $5, $6, $7, $8)`,
      [
        worker_id,
        project_id,
        utcNow,
        localNow,
        clockIn.timezone_offset,
        'Admin forced clock out',
        admin_name,
        clockIn.session_id
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
