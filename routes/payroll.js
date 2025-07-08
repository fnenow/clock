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

function parseDateTime(str) {
  if (!str) return null;
  let s = str.trim().replace(' ', 'T');
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  let parts = s.split('T');
  if (parts.length === 2) {
    let [y, m, day] = parts[0].split('-');
    let [h, min] = parts[1].split(':');
    d = new Date(Number(y), Number(m) - 1, Number(day), Number(h), Number(min));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
function getISOWeekKey(date) {
  const tmp = new Date(date.valueOf());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
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

// Split daily OT for each workday (native JS)
async function splitDailyOvertime(sessions) {
  let result = [];
  let byDay = groupByWorkerProjectDate(sessions);
  for (let key in byDay) {
    let dayRows = byDay[key];
    dayRows.sort((a, b) => {
      let aTime = a.datetime_local || a.datetime_utc || '';
      let bTime = b.datetime_local || b.datetime_utc || '';
      return aTime.localeCompare(bTime);
    });
    let pairs = [];
    let stack = [];
    for (let row of dayRows) {
      if (row.action === 'in') stack.push(row);
      if (row.action === 'out' && stack.length) {
        let inRow = stack.pop();
        pairs.push({ in: inRow, out: row });
      }
    }
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
      // Only Daily or Weekly for ot_type (no 'regular')
      if (regH > 0) {
        result.push({
          ...pp.in,
          datetime_out_local: pp.out.datetime_local,
          regular_time: Number(regH.toFixed(2)),
          overtime: 0,
          ot_type: '', // Empty, not 'regular'
          pay_rate,
          pay_amount: Number((regH * pay_rate).toFixed(2)),
          billed: pp.in.billed,
          billed_date: pp.in.billed_date,
          paid: pp.in.paid,
          paid_date: pp.in.paid_date,
        });
      }
      if (otH > 0) {
        result.push({
          ...pp.in,
          datetime_out_local: pp.out.datetime_local,
          regular_time: 0,
          overtime: Number(otH.toFixed(2)),
          ot_type: 'Daily',
          pay_rate: Number((pay_rate * 1.5).toFixed(2)),
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

// Split weekly OT (native JS)
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
    rows.forEach(r => { if (!r.ot_type) totalReg += Number(r.regular_time || 0); }); // only rows with ot_type='' (regular)
    if (totalReg <= 40) {
      results = results.concat(rows);
    } else {
      let regLeft = 40;
      for (let r of rows) {
        if (r.ot_type) { // Only split regulars
          results.push(r);
          continue;
        }
        let hr = Number(r.regular_time || 0);
        let pay_rate = r.pay_rate;
        if (regLeft > 0) {
          if (hr <= regLeft) {
            results.push({ ...r, regular_time: Number(hr.toFixed(2)), ot_type: '' });
            regLeft -= hr;
          } else {
            if (regLeft > 0) {
              results.push({
                ...r,
                regular_time: Number(regLeft.toFixed(2)),
                overtime: 0,
                ot_type: '',
                pay_rate,
                pay_amount: Number((regLeft * pay_rate).toFixed(2))
              });
            }
            let otH = hr - regLeft;
            if (otH > 0) {
              results.push({
                ...r,
                regular_time: 0,
                overtime: Number(otH.toFixed(2)),
                ot_type: 'Weekly',
                pay_rate: Number((pay_rate * 1.5).toFixed(2)),
                pay_amount: Number((otH * pay_rate * 1.5).toFixed(2))
              });
            }
            regLeft = 0;
          }
        } else {
          results.push({
            ...r,
            regular_time: 0,
            overtime: Number(hr.toFixed(2)),
            ot_type: 'Weekly',
            pay_rate: Number((pay_rate * 1.5).toFixed(2)),
            pay_amount: Number((hr * pay_rate * 1.5).toFixed(2))
          });
        }
      }
    }
  }
  return results;
}

// Sum Regular/OT/Amount per worker
function summarizeByWorker(rows) {
  let sums = {};
  rows.forEach(r => {
    let name = r.worker_name || r.worker_id;
    if (!sums[name]) sums[name] = { worker_name: name, regular_time: 0, overtime: 0, pay_amount: 0 };
    sums[name].regular_time += Number(r.regular_time || 0);
    sums[name].overtime     += Number(r.overtime || 0);
    sums[name].pay_amount   += Number(r.pay_amount || 0);
  });
  // Round up to 2 decimals
  Object.values(sums).forEach(s => {
    s.regular_time = Number(s.regular_time.toFixed(2));
    s.overtime     = Number(s.overtime.toFixed(2));
    s.pay_amount   = Number(s.pay_amount.toFixed(2));
  });
  return Object.values(sums);
}

// ========== MAIN API ========== //

// GET /api/payroll
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
    let workerSums = summarizeByWorker(finalRows);
    res.json({ rows: finalRows, workerSums });
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

// POST /api/payroll/update-status
router.post('/update-status', async (req, res) => {
  const { ids, field, value } = req.body;
  if (!Array.isArray(ids) || !['billed', 'paid'].includes(field)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const dateField = field + '_date';
  const dateValue = new Date().toISOString(); // use server time

  try {
    await pool.query(
      `UPDATE clock_entries
       SET ${field} = $1, ${dateField} = $2
       WHERE id = ANY($3::int[])`,
      [value, dateValue, ids]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating billed/paid status:', e);
    res.status(500).json({ error: 'Failed to update entries' });
  }
});


module.exports = router;
