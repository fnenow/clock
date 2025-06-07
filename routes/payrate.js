const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get current pay rate for worker
router.get('/current/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const q = await pool.query(
    "SELECT rate FROM pay_rates WHERE worker_id=$1 AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY start_date DESC LIMIT 1",
    [worker_id]
  );
  res.json({ rate: q.rows[0]?.rate || 0 });
});

// Create new pay rate (historical)
router.post('/', async (req, res) => {
  const { worker_id, rate, start_date } = req.body;
  await pool.query(
    `INSERT INTO pay_rates (worker_id, rate, start_date) VALUES ($1, $2, $3)`,
    [worker_id, rate, start_date]
  );
  res.json({ success: true });
});

// List all pay rates for a worker
router.get('/history/:worker_id', async (req, res) => {
  const { worker_id } = req.params;
  const q = await pool.query(
    `SELECT * FROM pay_rates WHERE worker_id=$1 ORDER BY start_date DESC`,
    [worker_id]
  );
  res.json(q.rows);
});

module.exports = router;
