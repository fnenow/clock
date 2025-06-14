const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// Utility: Extract last 5 digits from phone
function last5(phone) {
  return phone.replace(/\D/g, '').slice(-5);
}

// Add worker
router.post('/', async (req, res) => {
  const { name, phone, start_date, note, worker_id: customId } = req.body;
  let worker_id = customId || last5(phone);
  if (!worker_id || worker_id.length < 3) return res.status(400).json({ error: "Invalid worker ID" });
  const password_hash = await bcrypt.hash(worker_id, 10);
  try {
    await pool.query(
      `INSERT INTO workers (worker_id, name, phone, start_date, note, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [worker_id, name, phone, start_date, note, password_hash]
    );
    res.json({ success: true, worker_id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: "Worker ID already exists" });
    res.status(500).json({ error: e.message });
  }
});

// Update worker info
router.put('/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const { name, phone, start_date, end_date, note, inactive } = req.body;
  await pool.query(
    `UPDATE workers SET name=$1, phone=$2, start_date=$3, end_date=$4, note=$5, inactive=$6 WHERE worker_id=$7`,
    [name, phone, start_date, end_date, note, !!inactive, worker_id]
  );
  res.json({ success: true });
});

// Delete worker
router.delete('/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  await pool.query('DELETE FROM workers WHERE worker_id=$1', [worker_id]);
  res.json({ success: true });
});

// List all workers
router.get('/list', async (req, res) => {
  const q = await pool.query('SELECT * FROM workers ORDER BY created_at DESC');
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

// Assign worker to project
router.post('/:worker_id/assign', async (req, res) => {
  const { worker_id } = req.params;
  const { project_id } = req.body;
  await pool.query(
    'INSERT INTO project_workers (project_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [project_id, worker_id]
  );
  res.json({ success: true });
});

// Unassign worker from project
router.post('/:worker_id/unassign', async (req, res) => {
  const { worker_id } = req.params;
  const { project_id } = req.body;
  await pool.query('DELETE FROM project_workers WHERE project_id=$1 AND worker_id=$2', [project_id, worker_id]);
  res.json({ success: true });
});

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

module.exports = router;
