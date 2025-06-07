const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// Worker login
router.post('/login', async (req, res) => {
  const { worker_id, password } = req.body;
  const q = await pool.query('SELECT * FROM workers WHERE worker_id=$1', [worker_id]);
  const worker = q.rows[0];
  if (!worker) return res.json({ success: false, message: 'User not found' });
  const match = await bcrypt.compare(password, worker.password_hash);
  if (!match) return res.json({ success: false, message: 'Invalid password' });
  res.json({ success: true, worker: { worker_id: worker.worker_id, name: worker.name } });
});

// Change password
router.post('/change-password', async (req, res) => {
  const { worker_id, old_password, new_password } = req.body;
  const q = await pool.query('SELECT * FROM workers WHERE worker_id=$1', [worker_id]);
  const worker = q.rows[0];
  if (!worker) return res.json({ success: false, message: 'User not found' });
  const match = await bcrypt.compare(old_password, worker.password_hash);
  if (!match) return res.json({ success: false, message: 'Old password incorrect' });
  const newHash = await bcrypt.hash(new_password, 10);
  await pool.query('UPDATE workers SET password_hash=$1 WHERE worker_id=$2', [newHash, worker_id]);
  res.json({ success: true });
});

// Get all workers (for admin pages)
router.get('/list', async (req, res) => {
  const q = await pool.query('SELECT * FROM workers');
  res.json(q.rows);
});

// Get projects assigned to worker
router.get('/projects/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const q = await pool.query(
    `SELECT p.* FROM projects p
     JOIN project_workers pw ON p.id = pw.project_id
     WHERE pw.worker_id=$1 AND (p.hidden IS FALSE OR p.hidden IS NULL)`,
    [worker_id]
  );
  res.json(q.rows);
});

module.exports = router;
