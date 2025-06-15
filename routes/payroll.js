const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper: Get most recent pay rate for worker at a date
async function getActivePayRate(worker_id, date) {
  const q = await pool.query(
    `SELECT rate FROM pay_rates
      WHERE worker_id = $1 AND start_date <= $2
        AND (end_date IS NULL OR end_date >= $2)
      ORDER BY start_date DESC LIMIT 1`,
    [worker_id, date]
  );
  return q.rows[0]?.rate || 0;
}

// Parse 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DDTHH:mm' into JS Date
function parseDateTime(str) {
  if (!str) return null;
  let s = str.trim().replace(' ', 'T');
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try manual split if needed
  let parts = s.split('T');
  if (parts.length === 2) {
    let [y, m, day] = parts[0].split('-');
    let [h, min] = parts[1].split(':');
    d = new Date(Number(y), Number(m) - 1, Number(day), Number(h), Number(min));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Compute ISO week string for a given JS Date, e.g. '2025-W24'
function getISOWeekKey(date) {
  const tmp = new Date(date.valueOf());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Group by: worker_id, project_id, day (YYYY-MM-DD)
function groupByWorkerProjectDate(sessions) {
  let groups = {};
  sessions.forEach(row => {
    let dateStr = row.datetime_local || row.datetime_utc;
    if (!dateStr) return;
    let day = dateStr.slice(0, 10);
    let key = `${row.worker_id}|${row.project_id}|${day}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return groups;
}

// Helper: Split daily OT for each workday (native JS)
async function splitDailyOvertime(sessions) {
  let result = [];
  let byDay = groupByWorkerProjectDate(sessions);
  for (let key in byDay) {
    let dayRows = byDay[key];
    // Sort by in/out time
    dayRows.sort((a, b) => {
      let aTime = a.datetime_local || a.datetime_utc || '';
      let bTime = b.datetime_local || b.datetime_utc || '';
      return aTime.localeCompare(bTime);
    });
    // Pair ins/outs
    let pairs = [];
    let stack = [];
    for (let row of dayRows) {
      if (row.action === 'in') stack.push(row);
      if (row.action === 'out' && stack.length) {
        let inRow = stack.pop();
        pairs.push({ in: inRow, out: row });
      }
    }
    // For each pair, calculate duration in hours
    let payPairs = [];
    for (let p of pairs) {
      let inStr = p.in.datetime_local || p.in.datetime_utc;
      let outStr = p.out.datetime_local || p.out.datetime_utc;
      let inTime = parseDateTime(inStr);
      let outTime = parseDateTime(outStr);
      if (!inTime || !outTime) {
        console.warn('Payroll: Skipping invalid datetime:', inStr, outStr, p);
        continue;
      }
      let ms = outTime - inTime;
      let hours = ms / (1000 * 60 * 60);
      if (hours < 0) hours = 0;
      payPairs.push({ ...p, hours, inTime, outTime });
    }
    // Split into regular/OT if needed
    let regLeft = 8;
    for (let pp of payPairs) {
      let regH = 0, otH = 0;
      if (regLeft > 0) {
        if (pp.hours <= regLeft) {
          regH = pp.hours;
          regLeft -= pp.hours;
        } else {
          regH = regLeft;
          otH = pp.hours - regLeft;
          regLeft = 0;
        }
      } else {
        otH = pp.hours;
      }
      let dateStr = pp.in.datetime_local || pp.in.datetime_utc;
      let pay_rate = pp.in.pay_rate;
      if (!pay_rate || Number(pay_rate) === 0) {
        pay_rate = await getActivePayRate(pp.in.worker_id, dateStr ? dateStr.slice(0, 10) : '');
      }
      // Regular portion
      if (regH > 0) {
        result.push({
          ...pp.in,
          datetime_out_local: pp.out.datetime_local,
          regular_time: regH,
          overtime: 0,
          ot_type: 'regular',
          pay_rate,
          pay_amount: Number((regH * pay_rate).toFixed(2)),
          billed: pp.in.billed,
          billed_date: pp.in.billed_date,
          paid: pp.in.paid,
          paid_date: pp.in.paid_date,
        });
      }
      // Daily OT portion
      if (otH > 0) {
        result.push({
          ...pp.in,
          datetime_out_local: pp.out.datetime_local,
          regular_time: 0,
          overtime: otH,
          ot_type: 'daily',
          pay_rate: (pay_rate * 1.5),
          pay_amount: Number((otH * pay_rate * 1.5).toFixed(2)),
          billed: pp.in.billed,
          billed_date: pp.in.billed_date,
          paid: pp.in.paid,
          paid_date: pp.in.paid_date,
        });
      }
    }
  }
  return result;
}

// Helper: Split weekly OT (native JS)
function splitWeeklyOvertime(dailyRows) {
  let byWeek = {};
  dailyRows.forEach(row => {
    let dateStr = row.datetime_local || row.datetime_utc;
    let d = parseDateTime(dateStr);
    if (!d) {
      console.warn('Payroll: Skipping row with missing/invalid datetime for weekly OT:', row);
      return;
    }
    let week = getISOWeekKey(d); // e.g. "2025-W24"
    let key = `${row.worker_id}|${week}`;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(row);
  });
  let results = [];
  for (let key in byWeek) {
    let rows = byWeek[key];
    let totalReg = 0;
    rows.forEach(r => { if (r.ot_type === 'regular') totalReg += Number(r.regular_time || 0); });
    if (totalReg <= 40) {
      results = results.concat(rows);
    } else {
      let regLeft = 40;
      for (let r of rows) {
        if (r.ot_type !== 'regular') {
          results.push(r);
          continue;
        }
        let hr = Number(r.regular_time || 0);
        let pay_rate = r.pay_rate;
        if (regLeft > 0) {
          if (hr <= regLeft) {
            results.push(r);
            regLeft -= hr;
          } else {
            if (regLeft > 0) {
              results.push({
                ...r,
                regular_time: regLeft,
                overtime: 0,
                ot_type: 'regular',
                pay_rate,
                pay_amount: Number((regLeft * pay_rate).toFixed(2))
              });
            }
            let otH = hr - regLeft;
            if (otH > 0) {
              results.push({
                ...r,
                regular_time: 0,
                overtime: otH,
                ot_type: 'weekly',
                pay_rate: pay_rate * 1.5,
                pay_amount: Number((otH * pay_rate * 1.5).toFixed(2))
              });
            }
            regLeft = 0;
          }
        } else {
          results.push({
            ...r,
            regular_time: 0,
            overtime: hr,
            ot_type: 'weekly',
            pay_rate: pay_rate * 1.5,
            pay_amount: Number((hr * pay_rate * 1.5).toFixed(2))
          });
        }
      }
    }
  }
  return results;
}

// ========== MAIN API ========== //

// GET /api/payroll?start_date=...&end_date=...&worker_id=...&project_id=...&billed=...&paid=...
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, worker_id, project_id, billed, paid } = req.query;
    let wheres = [];
    let vals = [];
    if (start_date) { vals.push(start_date); wheres.push(`ce.datetime_local >= $${vals.length}`); }
    if (end_date)   { vals.push(end_date);   wheres.push(`ce.datetime_local <= $${vals.length}`); }
    if (worker_id)  { vals.push(worker_id);  wheres.push(`ce.worker_id = $${vals.length}`); }
    if (project_id) { vals.push(project_id); wheres.push(`ce.project_id = $${vals.length}`); }
    if (billed === 'true')  { wheres.push('ce.billed = true'); }
    if (billed === 'false') { wheres.push('(ce.billed IS false OR ce.billed IS NULL)'); }
    if (paid === 'true')    { wheres.push('ce.paid = true'); }
    if (paid === 'false')   { wheres.push('(ce.paid IS false OR ce.paid IS NULL)'); }
    let whereClause = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
    // Get all clock entries matching filter
    const q = await pool.query(`
      SELECT ce.*, w.name as worker_name, p.name as project_name
      FROM clock_entries ce
      JOIN workers w ON ce.worker_id = w.worker_id
      JOIN projects p ON ce.project_id = p.id
      ${whereClause}
      ORDER BY ce.datetime_local ASC
    `, vals);

    // --- Split into daily/weekly OT sessions ---
    let dailyRows = await splitDailyOvertime(q.rows);
    let finalRows = splitWeeklyOvertime(dailyRows);

    res.json(finalRows);
  } catch (e) {
    console.error('API /api/payroll error:', e);
    res.status(500).json({ error: e.message || e.toString() });
  }
});

// POST /api/payroll/bill
router.post('/bill', async (req, res) => {
  const { entry_ids, billed_date } = req.body;
  if (!Array.isArray(entry_ids) || !billed_date) return res.status(400).json({ error: 'Missing parameters' });
  await pool.query(
    `UPDATE clock_entries SET billed=TRUE, billed_date=$1 WHERE id = ANY($2::int[])`,
    [billed_date, entry_ids]
  );
  res.json({ success: true });
});

// POST /api/payroll/paid
router.post('/paid', async (req, res) => {
  const { entry_ids, paid_date } = req.body;
  if (!Array.isArray(entry_ids) || !paid_date) return res.status(400).json({ error: 'Missing parameters' });
  await pool.query(
    `UPDATE clock_entries SET paid=TRUE, paid_date=$1 WHERE id = ANY($2::int[])`,
    [paid_date, entry_ids]
  );
  res.json({ success: true });
});

// GET /api/payroll/export
router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date, worker_id, project_id, billed, paid } = req.query;
    let wheres = [];
    let vals = [];
    if (start_date) { vals.push(start_date); wheres.push(`ce.datetime_local >= $${vals.length}`); }
    if (end_date)   { vals.push(end_date);   wheres.push(`ce.datetime_local <= $${vals.length}`); }
    if (worker_id)  { vals.push(worker_id);  wheres.push(`ce.worker_id = $${vals.length}`); }
    if (project_id) { vals.push(project_id); wheres.push(`ce.project_id = $${vals.length}`); }
    if (billed === 'true')  { wheres.push('ce.billed = true'); }
    if (billed === 'false') { wheres.push('(ce.billed IS false OR ce.billed IS NULL)'); }
    if (paid === 'true')    { wheres.push('ce.paid = true'); }
    if (paid === 'false')   { wheres.push('(ce.paid IS false OR ce.paid IS NULL)'); }
    let whereClause = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
    const q = await pool.query(`
      SELECT ce.*, w.name as worker_name, p.name as project_name
      FROM clock_entries ce
      JOIN workers w ON ce.worker_id = w.worker_id
      JOIN projects p ON ce.project_id = p.id
      ${whereClause}
      ORDER BY ce.datetime_local ASC
    `, vals);

    let dailyRows = await splitDailyOvertime(q.rows);
    let finalRows = splitWeeklyOvertime(dailyRows);

    // Format CSV
    let csv = [
      [
        'ID', 'Worker', 'Project', 'In', 'Out', 'Regular Hrs', 'OT Hrs', 'OT Type',
        'Pay Rate', 'Amount', 'Bill Date', 'Paid Date', 'Note'
      ].join(',')
    ];
    for (let row of finalRows) {
      csv.push([
        row.id,
        `"${row.worker_name}"`,
        `"${row.project_name}"`,
        row.datetime_local || '',
        row.datetime_out_local || '',
        row.regular_time || 0,
        row.overtime || 0,
        row.ot_type || '',
        row.pay_rate ? Number(row.pay_rate).toFixed(2) : '',
        row.pay_amount ? Number(row.pay_amount).toFixed(2) : '',
        row.billed_date || '',
        row.paid_date || '',
        `"${row.note || ''}"`
      ].join(','));
    }
    // Filename: payroll_yymmddhh.csv
    const now = new Date();
    const filename = `payroll_${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv.join('\n'));
  } catch (e) {
    console.error('API /api/payroll/export error:', e);
    res.status(500).json({ error: e.message || e.toString() });
  }
});

module.exports = router;
