const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware: require login
function requireWorkerLogin(req, res, next) {
  if (req.session && req.session.worker_id) return next();
  res.status(401).json({ message: "Not logged in" });
}

router.use(requireWorkerLogin);

// GET /api/worker-dashboard/check
router.get('/check', (req, res) => {
  res.json({ loggedIn: true, worker_id: req.session.worker_id, name: req.session.worker_name });
});

// GET /api/worker-dashboard/entries
router.get('/entries', async (req, res) => {
  const worker_id = req.session.worker_id;
  const q = await pool.query(`
    SELECT ce.*, w.name AS worker_name, p.name AS project_name
    FROM clock_entries ce
    LEFT JOIN workers w ON ce.worker_id = w.worker_id
    LEFT JOIN projects p ON ce.project_id = p.id
    WHERE ce.worker_id = $1
    ORDER BY ce.datetime_local ASC
  `, [worker_id]);
  res.json(q.rows);
});

// PATCH /api/worker-dashboard/entries/:id
router.patch('/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (note === undefined) return res.status(400).json({ message: "No note provided" });

  // Optionally: check that the entry belongs to the logged-in worker
  const q = await pool.query('SELECT worker_id FROM clock_entries WHERE id = $1', [id]);
  if (!q.rows.length || q.rows[0].worker_id != req.session.worker_id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await pool.query('UPDATE clock_entries SET note = $1 WHERE id = $2', [note, id]);
  res.json({ success: true });
});

module.exports = router;
