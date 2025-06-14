const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

require('dotenv').config();
const pool = require('./db');

const clockRoutes = require('./routes/clock');
const workerRoutes = require('./routes/worker');
const projectRouter = require('./routes/project');
const payrateRoutes = require('./routes/payrate');
const adminRoutes = require('./routes/admin');
const payrollRoutes = require('./routes/payroll');

const app = express();

app.use(cors());
app.use(express.json());
app.use(clockRoutes);

app.use(session({
  store: new pgSession({ pool }),
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use('/api/clock', clockRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/projects', projectRouter);
app.use('/api/payrate', payrateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payroll', payrollRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'timeclock.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FNE Time Clock server running on ${PORT}`));
