const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all projects
router.get('/', async (req, res) => {
  const q = await pool.query('SELECT * FROM projects WHERE hidden IS FALSE OR hidden IS NULL ORDER BY id');
  res.json(q.rows);
});

// Create project
router.post('/', async (req, res) => {
  const { name, location, city, start_date, finish_date } = req.body;
  await pool.query(
    `INSERT INTO projects (name, location, city, start_date, finish_date) VALUES ($1, $2, $3, $4, $5)`,
    [name, location, city, start_date, finish_date]
  );
  res.json({ success: true });
});

// Edit project
router.put('/:id', async (req, res) => {
  const { name, location, city, start_date, finish_date, hidden } = req.body;
  await pool.query(
    `UPDATE projects SET name=$1, location=$2, city=$3, start_date=$4, finish_date=$5, hidden=$6 WHERE id=$7`,
    [name, location, city, start_date, finish_date, hidden, req.params.id]
  );
  res.json({ success: true });
});

// Delete project
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// Assign worker to project
router.post('/assign', async (req, res) => {
  const { project_id, worker_id } = req.body;
  await pool.query(
    `INSERT INTO project_workers (project_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [project_id, worker_id]
  );
  res.json({ success: true });
});

// Remove worker from project
router.post('/unassign', async (req, res) => {
  const { project_id, worker_id } = req.body;
  await pool.query(
    `DELETE FROM project_workers WHERE project_id=$1 AND worker_id=$2`,
    [project_id, worker_id]
  );
  res.json({ success: true });
});

module.exports = router;
