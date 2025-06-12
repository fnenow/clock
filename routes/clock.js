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

// CLOCK IN
router.post('/in', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone_offset } = req.body;
  console.log('[CLOCK IN] Received:', { datetime_local, timezone_offset });
  try {
    // Prevent double clock-in
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

    // -- Parse local time as "YYYY-MM-DDTHH:mm" with no zone, then compute UTC manually
    // datetime_local is already a string like "2025-06-12T15:19"
    // Convert to Date object as if in local time
    const parts = datetime_local.split(/[-T:]/).map(Number);
    // JS months are 0-based
    const localDate = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], 0, 0);

    // Calculate UTC date by subtracting offset (offset is in minutes, e.g. -420)
    const utcMillis = localDate.getTime() - timezone_offset * 60000;
    const utcDate = new Date(utcMillis);

    // Format YYYY-MM-DDTHH:mm (no zone info)
    function toYMDHM(date) {
      const pad = n => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    console.log('[CLOCK IN] Parsed:', {
      datetime_local: toYMDHM(localDate),
      datetime_utc: toYMDHM(utcDate)
    });

    await pool.query(
      `INSERT INTO clock_entries 
        (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, pay_rate, session_id)
       VALUES 
        ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
      [
        worker_id,
        project_id,
        toYMDHM(utcDate),
        toYMDHM(localDate),
        timezone_offset,
        note,
        pay_rate,
        session_id
      ]
    );
    res.json({ success: true, session_id });
  } catch (e) {
    console.error('[CLOCK IN ERROR]', e);
    res.status(500).json({ message: e.message });
  }
});

// CLOCK OUT
router.post('/out', async (req, res) => {
  const { worker_id, project_id, note, datetime_local, timezone_offset, session_id } = req.body;
  console.log('[CLOCK OUT] Received:', { datetime_local, timezone_offset });
  try {
    if (!session_id) return res.status(400).json({ message: "Missing session_id" });

    // Make sure there's an open clock-in session
    const { rows } = await pool.query(
      `SELECT * FROM clock_entries WHERE worker_id=$1 AND project_id=$2 AND session_id=$3 AND action='in'
       AND NOT EXISTS (
         SELECT 1 FROM clock_entries AS out
         WHERE out.session_id=$3 AND out.action='out'
       )`,
      [worker_id, project_id, session_id]
    );
    if (!rows.length) return res.status(400).json({ message: "No matching open clock-in session found" });

    // Repeat parsing logic for out time
    const parts = datetime_local.split(/[-T:]/).map(Number);
    const localDate = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], 0, 0);
    const utcMillis = localDate.getTime() - timezone_offset * 60000;
    const utcDate = new Date(utcMillis);

    function toYMDHM(date) {
      const pad = n => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    console.log('[CLOCK OUT] Parsed:', {
      datetime_local: toYMDHM(localDate),
      datetime_utc: toYMDHM(utcDate)
    });

    await pool.query(
      `INSERT INTO clock_entries 
        (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, session_id)
       VALUES 
        ($1, $2, 'out', $3, $4, $5, $6, $7)`,
      [
        worker_id,
        project_id,
        toYMDHM(utcDate),
        toYMDHM(localDate),
        timezone_offset,
        note,
        session_id
      ]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[CLOCK OUT ERROR]', e);
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

// ADMIN FORCE CLOCK OUT
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
    // Use current server UTC time, truncate to minute
    const now = new Date();
    now.setSeconds(0, 0);
    const nowUtc = new Date(now.getTime());
    const nowLocal = new Date(nowUtc.getTime() + (clockIn.timezone_offset * 60000));

    function toYMDHM(date) {
      const pad = n => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    await pool.query(
      `INSERT INTO clock_entries
         (worker_id, project_id, action, datetime_utc, datetime_local, timezone_offset, note, admin_forced_by, session_id)
       VALUES
         ($1, $2, 'out', $3, $4, $5, $6, $7, $8)`,
      [
        worker_id,
        project_id,
        toYMDHM(nowUtc),
        toYMDHM(nowLocal),
        clockIn.timezone_offset,
        'Admin forced clock out',
        admin_name,
        clockIn.session_id
      ]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[ADMIN FORCE CLOCK OUT ERROR]', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
