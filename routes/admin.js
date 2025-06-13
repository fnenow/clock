const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// Admin login (simple session, no JWT)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const q = await pool.query('SELECT * FROM admin_users WHERE username=$1', [username]);
  const admin = q.rows[0];
  if (!admin) return res.json({ success: false, message: 'User not found' });
  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) return res.json({ success: false, message: 'Invalid password' });
  req.session.admin = username;
  res.json({ success: true, username });
});

// List currently clocked-in (not clocked-out) sections
router.get('/clocked-out', async (req, res) => {
  const q = await pool.query(`
    SELECT 
      cin.worker_id,
      cin.project_id,
      w.name as worker_name,
      p.name as project_name,
      cin.datetime_local as clock_in_time,
      cout.datetime_local as clock_out_time,
      cin.note as clock_in_note,
      cout.note as clock_out_note,
      cin.pay_rate,
      cout.admin_forced_by,
      cin.session_id,
      EXTRACT(EPOCH FROM (
        CAST(cout.datetime_utc AS timestamp) - CAST(cin.datetime_utc AS timestamp)
      )) AS duration_sec
    FROM clock_entries cin
    JOIN clock_entries cout
      ON cin.worker_id = cout.worker_id
      AND cin.project_id = cout.project_id
      AND cin.session_id = cout.session_id
      AND cin.action = 'in'
      AND cout.action = 'out'
      AND cout.datetime_utc > cin.datetime_utc
    JOIN workers w ON cin.worker_id = w.worker_id
    JOIN projects p ON cin.project_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM clock_entries c2
      WHERE c2.worker_id = cin.worker_id
        AND c2.project_id = cin.project_id
        AND c2.session_id = cin.session_id
        AND c2.action = 'out'
        AND c2.datetime_utc > cin.datetime_utc
        AND c2.datetime_utc < cout.datetime_utc
    )
    ORDER BY cout.datetime_utc DESC
    LIMIT 100
  `);
  res.json(q.rows);
});


// List clocked-out sections
router.get('/clocked-out', async (req, res) => {
  const q = await pool.query(`
    SELECT 
      cin.worker_id,
      cin.project_id,
      w.name as worker_name,
      p.name as project_name,
      cin.datetime_local as clock_in_time,
      cout.datetime_local as clock_out_time,
      cout.note as out_note,
      cin.note as in_note,
      cin.pay_rate,
      cout.admin_forced_by,
      EXTRACT(EPOCH FROM (cout.datetime_local - cin.datetime_local)) AS duration_sec
    FROM clock_entries cin
    JOIN clock_entries cout
      ON cin.worker_id = cout.worker_id
      AND cin.project_id = cout.project_id
      AND cin.action = 'in'
      AND cout.action = 'out'
      AND cout.datetime_local > cin.datetime_local
      AND NOT EXISTS (
        SELECT 1 FROM clock_entries c2
        WHERE c2.worker_id = cin.worker_id
          AND c2.project_id = cin.project_id
          AND c2.action = 'out'
          AND c2.datetime_local > cin.datetime_local
          AND c2.datetime_local < cout.datetime_local
      )
    JOIN workers w ON cin.worker_id = w.worker_id
    JOIN projects p ON cin.project_id = p.id
    ORDER BY cout.datetime_local DESC
    LIMIT 100
  `);
  res.json(q.rows);
});


module.exports = router;
