router.get('/session/:session_id/status', async (req, res) => {
  const { session_id } = req.params;
  const q = await pool.query(
    `SELECT 1 FROM clock_entries WHERE session_id=$1 AND action='out' LIMIT 1`,
    [session_id]
  );
  res.json({ open: q.rows.length === 0 });
});
