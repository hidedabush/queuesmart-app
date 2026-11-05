# QueueSmart setup

How to get the app, the server and the database running on your own laptop.
Everything is free and runs locally. Nothing is hosted online.

There are two ways to get the database:

- **Automatic (recommended):** Docker runs MySQL for you, and one command
  sets everything up. Go through steps 1–3, then **4A**.
- **Manual:** you install MySQL yourself. Use this if you can't or don't want
  to install Docker. Go through steps 1–3, then **4B**.

Each teammate gets their **own** database with the same demo data. Changes you
make don't show up on anyone else's laptop. To share a snapshot, see
[Sharing data](#sharing-data).

---

## 1. Install the tools (once per laptop)

| Tool | Where | Check it worked |
| --- | --- | --- |
| **Node.js 24 LTS** | https://nodejs.org | `node -v` prints v24.3 or newer (v22.13+ also works) |
| **Git** | https://git-scm.com | `git --version` |
| **Expo Go** (phone) | App Store / Google Play | Settings in the app shows version 57.x |
| **MySQL Workbench** (optional) | `winget install --id Oracle.MySQLWorkbench --source winget`, or https://dev.mysql.com/downloads/workbench/ | Lets you look at the tables. The app does not need it. |

## 2. Get the code

```bash
git clone <repo-url>
cd queuesmart-app
```

Run every command below from this folder (the one with `package.json` and
`start-all.bat`), unless it says `cd server` first.

## 3. Install the packages

```bash
npm ci              # the app
cd server
npm ci              # the server
cd ..
```

Run these again after a `git pull` that changes a `package.json` or
`package-lock.json`.

---

## 4A. Database, automatic (Docker)

1. Install **Docker Desktop**: https://www.docker.com/products/docker-desktop/.
   On Windows, accept the WSL 2 option if the installer asks, and restart if
   it says to.
2. Open Docker Desktop and wait until it says **Engine running**. It has to be
   open whenever you work on the project.
3. Start everything:

   **Windows:** double-click `start-all.bat`, or run `.\start-all.bat` in a
   terminal. It starts the database, then opens two windows: **QueueSmart API**
   (the server) and **QueueSmart Expo** (the app).

   **Mac / Linux**, or if you prefer terminals:

   ```bash
   cd server
   npm run db:start    # starts MySQL in Docker and fills it with demo data
   npm run dev         # the server, on http://localhost:4000
   ```

   Then, in a second terminal from the project folder: `npx expo start`.

`npm run db:start` does all of the database setup:

1. creates `server/.env` from `server/.env.example`, with a random `JWT_SECRET`
2. starts MySQL 8.4 in Docker (the first time, it downloads it, which takes a
   minute or two)
3. creates the tables and triggers, and adds the demo data if the database
   is empty

You can run it as often as you like. It keeps your `.env` and your data.

Go to [step 5](#5-use-the-app).

---

## 4B. Database, manual (no Docker)

### Install MySQL

**Windows**

1. Download **MySQL Community Server 8.4 LTS** (the MSI installer) from
   https://dev.mysql.com/downloads/mysql/. You don't need an Oracle account.
   Click _No thanks, just start my download_.
2. Run it and choose **Typical**. At the end, **MySQL Configurator** opens.
3. In the Configurator:
   - keep the port at **3306**
   - set a **root password** and write it down
   - keep **Configure MySQL Server as a Windows Service** and **Start the
     MySQL Server at System Startup** ticked
   - click through with the other defaults, then **Execute**

**Mac**

```bash
brew install mysql
brew services start mysql      # starts now, and at every login
mysql_secure_installation      # sets the root password
```

### Create the database

Open a MySQL prompt as root. On Windows, use **MySQL 8.4 Command Line Client**
from the Start menu. On Mac, run `mysql -u root -p`. Then run:

```sql
CREATE DATABASE queuesmart;
```

Type `exit` to leave. You can also do this in Workbench.

### Point the server at it

1. Copy `server/.env.example` to `server/.env`. Git ignores `.env`, so your
   password stays on your laptop.
2. In `server/.env`, replace the `DATABASE_URL` line with:

   ```
   DATABASE_URL=mysql://root:YOUR_PASSWORD@localhost:3306/queuesmart
   ```

   If your password has any of `# @ : / ? %` in it, replace each one with its
   URL code: `#` → `%23`, `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`,
   `%` → `%25`. For example, `Pa#ss` becomes `Pa%23ss`.

3. Set `JWT_SECRET` to any long random text.

Use the **root** user. MySQL only lets a user with full rights create the
triggers this project uses.

### Create the tables and start

```bash
cd server
npm run db:start    # sees it's not Docker, so it just creates the tables and demo data
npm run dev         # the server, on http://localhost:4000
```

Then, in a second terminal from the project folder: `npx expo start`. On
Windows, `start-all.bat` works too. It skips Docker when `DATABASE_URL` points
at your own MySQL.

---

## 5. Use the app

A QR code appears in the Expo terminal. Scan it with the Camera app on an iPhone,
or with the Expo Go app on Android. Your phone and laptop must be on the same
Wi-Fi. Press `w` to open the app in a browser instead.

On campus Wi-Fi, phones often can't reach the laptop. Use `npx expo start
--tunnel` instead.

Sign in with the demo accounts:

| Account | Email | Password |
| --- | --- | --- |
| Office staff (admin) | `admin@queuesmart.test` | `Admin#2026` |
| Demo patient | `patient@queuesmart.test` | `Patient#2026` |

To check the server on its own, open http://localhost:4000/health. It
should show `{"ok":true}`.

---

## Everyday commands

Run these from `server/`.

| Command | What it does |
| --- | --- |
| `npm run db:start` | Starts the database (Docker) and creates any missing tables. Safe to run any time. |
| `npm run db:down` | Stops the Docker database. Your data is kept. |
| `npm run dev` | Runs the server and restarts it when you save a file. |
| `npm run db:migrate` | Creates new tables and triggers after a `git pull` that changed `schema.sql` or `triggers.sql`. |
| `npm run db:reset` | **Deletes all your data**, rebuilds the tables and adds the demo data again. Use it after a change to an existing table. |
| `npm test` | Unit and API tests. They need no database. |
| `npm run test:mysql` | Checks the real SQL against your database. Run it after changing anything in `src/database/`. |

To wipe the Docker database completely, run `docker compose down -v` in
`server/`, then `npm run db:start`.

## Looking at the data in Workbench

Add a connection with **Hostname** `127.0.0.1`, **Port** `3306`, **Username**
`root`, and **Default Schema** `queuesmart`. The password is `queuesmart` for
the Docker database, or your own root password for a manual install.

## Sharing data

Everyone's database is separate. To give a teammate your exact data:

1. You: `npm run db:dump`. It writes `server/src/database/dump.sql`. Commit
   it, or send the file.
2. Them: `npm run db:load`. **This replaces all of their data** with yours.

---

## Troubleshooting

| You see | Fix |
| --- | --- |
| `Docker is not installed` | Install Docker Desktop (4A), or set up MySQL yourself (4B). |
| `Docker is installed but not running` | Open Docker Desktop, wait for **Engine running**, then run it again. |
| `port is already allocated` / `3306` in use | Something else is using port 3306, usually a MySQL you installed. Use only one of the two: stop the Windows service **MySQL84** (in Services), or use that MySQL with 4B. |
| `Can't reach the database` | MySQL isn't running. For Docker: open Docker Desktop and run `npm run db:start`. For a manual install: start the **MySQL84** Windows service, or run `brew services start mysql` on Mac. |
| `Access denied for user 'root'` | Wrong password in `DATABASE_URL`. Check the special characters (4B). |
| `Unknown database 'queuesmart'` | Run `CREATE DATABASE queuesmart;` (4B). |
| `may not create triggers while binary logging is on` | You're not using the root user. Switch `DATABASE_URL` to root. |
| `DATABASE_URL is not set` | Run `npm run db:start`, or create `server/.env` (4B). |
| The phone can't load anything | Phone and laptop must be on the same Wi-Fi. Otherwise use `npx expo start --tunnel`, or set `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000` before `npx expo start`. |
