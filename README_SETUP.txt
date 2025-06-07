
# FNE Time Clock System

This is a modern time clock and payroll management system for contractors or small businesses, built with Node.js, Express, PostgreSQL, and Bootstrap.

## 🚀 Features

- Worker login and clock in/out (with project assignment)
- Admin dashboard to view, edit, and force clock-outs
- Project, Worker, and Payrate CRUD pages
- Payroll/unbilled reporting and CSV export
- Change password, audit trail, and admin authentication
- Clean, mobile-friendly Bootstrap UI

## 🗂️ Project Structure

- /public            # Bootstrap HTML and JS for all pages
- /routes            # Express route handlers
- /models/schema.sql # SQL for tables and test data
- db.js, server.js   # Main backend logic
- .env.example       # Sample env file
- README_SETUP.txt   # This file

## 🔑 Quick Start

1. **Clone your repo**

   git clone https://github.com/fnenow/clock.git
   cd clock

2. **Install dependencies**

   npm install

3. **Copy environment variables**

   cp .env.example .env

   Edit `.env` and fill in your PostgreSQL connection string and a random session secret.

   DATABASE_URL=postgresql://user:password@host:port/dbname
   SESSION_SECRET=changeme
   PORT=3000

   - On Railway, set these variables in the Railway dashboard’s “Variables” section instead.

4. **Create the database schema and test data**

   - Open your Railway PostgreSQL plugin.
   - Go to the **Query** tab.
   - Paste the content of `models/schema.sql` and click **Run**.

   This creates all tables and inserts test data:  
   - **Worker:** John Doe (worker_id: `12345`, password: `99999`)
   - **Project:** Test Project (assigned to John Doe)
   - **Payrate:** $30/hr for John Doe

5. **Run the server locally (for development)**

   node server.js

   Visit `http://localhost:3000/timeclock.html` in your browser.

6. **Deploy to Railway**

   - Push your code to GitHub.
   - Create a new project on Railway, deploy from your repo.
   - Set up environment variables (`DATABASE_URL`, `SESSION_SECRET`).
   - Railway will build and run your service.  
   - Open the generated URL, e.g., `https://your-app.up.railway.app/timeclock.html`.

## 🛠️ **Where to Replace or Modify for Deployment**

- **`.env`**
  - `DATABASE_URL`: Use your real Railway PostgreSQL connection string.
  - `SESSION_SECRET`: Use a secure random string.
  - `PORT`: Only needed for local; Railway sets this for you.

- **Database (models/schema.sql)**
  - Only run once to initialize tables and seed data.  
  - If you want a real user/project/payrate, modify or add to the INSERT statements.

- **Frontend/Branding**
  - Update HTML titles, headers, or text in `/public/*.html` as desired for your company.
  - Add your logo or adjust styling in `/public/css/style.css`.

- **Admin Accounts**
  - To create admin users, insert into the `admin_users` table (bcrypt hash passwords).  
  - Example SQL (replace with your username and hash):
    INSERT INTO admin_users (username, password_hash) VALUES ('admin', '$2b$10$...');
    Use a bcrypt hash generator online for your password.

- **API Endpoints**
  - You may expand `/api/worker`, `/api/project`, etc., for extra CRUD features.
  - To change default pages/routes, edit `server.js` (e.g., root redirect).

- **Security**
  - For production, consider enabling HTTPS, setting CORS policies, etc.

## 🧪 **Testing**

- **Worker login:**  
  Worker ID: `12345`, Password: `99999` (after running schema.sql)
- **Admin login:**  
  Use whatever admin user(s) you create manually in the database.

## 📬 **Questions or Issues?**

- Use GitHub Issues for bug reports or feature requests.
- For deployment problems, consult Railway and PostgreSQL documentation.

## ✅ **You’re ready to deploy!**

If you need sample bcrypt hash commands or want example admin SQL, just ask!
