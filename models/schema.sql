-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(5) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    note TEXT,
    inactive BOOLEAN DEFAULT FALSE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    city VARCHAR(100),
    start_date DATE,
    finish_date DATE,
    hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project assignment
CREATE TABLE IF NOT EXISTS project_workers (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id),
    worker_id VARCHAR(5) NOT NULL REFERENCES workers(worker_id)
);

-- Clock entries
CREATE TABLE IF NOT EXISTS clock_entries (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(5) NOT NULL REFERENCES workers(worker_id),
    project_id INT REFERENCES projects(id),
    action VARCHAR(10) CHECK (action IN ('in', 'out')) NOT NULL,
    datetime_utc TIMESTAMP NOT NULL,
    datetime_local TIMESTAMP,
    timezone VARCHAR(50),
    note TEXT,
    pay_rate NUMERIC(8, 2),
    regular_time NUMERIC(5, 2),
    overtime NUMERIC(5, 2),
    pay_amount NUMERIC(10, 2),
    paid BOOLEAN DEFAULT FALSE,
    paid_date DATE,
    billed BOOLEAN DEFAULT FALSE,
    billed_date DATE,
    admin_forced_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pay rates
CREATE TABLE IF NOT EXISTS pay_rates (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(5) NOT NULL REFERENCES workers(worker_id),
    rate NUMERIC(8, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a sample worker: John Doe, worker_id 12345, password "99999"
INSERT INTO workers (worker_id, name, phone, start_date, password_hash)
VALUES ('12345', 'John Doe', '4081234567', CURRENT_DATE, '$2a$12$AGg0VDTL0T5ebGo.QtEqSOieCbY27.Ifef5oeCU2DHfY7EA8S4k32') -- bcrypt hash for 99999
ON CONFLICT (worker_id) DO NOTHING;

-- Insert a sample project: Test Project
INSERT INTO projects (name, location, city, start_date)
VALUES ('Test Project', 'Test Location', 'Test City', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Assign John Doe to Test Project
INSERT INTO project_workers (project_id, worker_id)
SELECT p.id, w.worker_id FROM projects p, workers w
WHERE p.name='Test Project' AND w.worker_id='12345'
ON CONFLICT DO NOTHING;

-- Insert a sample pay rate: $30/hr
INSERT INTO pay_rates (worker_id, rate, start_date)
VALUES ('12345', 30.00, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Session table create
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
