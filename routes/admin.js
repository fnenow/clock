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
router.get('/clocking-in', async (req, res) => {
  const q = await pool.query(
    `SELECT ce.*, w.name as worker_name, p.name as project_name
     FROM clock_entries ce
     JOIN workers w ON ce.worker_id = w.worker_id
     JOIN projects p ON ce.project_id = p.id
     WHERE ce.action='in'
     AND NOT EXISTS (
       SELECT 1 FROM clock_entries ce2
       WHERE ce2.worker_id=ce.worker_id AND ce2.project_id=ce.project_id AND ce2.action='out' AND ce2.id > ce.id
     )
     ORDER BY ce.datetime_utc DESC`
  );
  res.json(q.rows);
});

// List clocked-out sections
router.get('/clocked-out', async (req, res) => {
  const q = await pool.query(
    `SELECT ce.*, w.name as worker_name, p.name as project_name
     FROM clock_entries ce
     JOIN workers w ON ce.worker_id = w.worker_id
     JOIN projects p ON ce.project_id = p.id
     WHERE ce.action='out'
     ORDER BY ce.datetime_utc DESC`
  );
  res.json(q.rows);
});

module.exports = router;
