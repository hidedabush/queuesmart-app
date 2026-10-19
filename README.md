# QueueSmart — Mobile App + Backend (Assignment 3)

React Native + Expo. Runs on Android and iOS from one codebase.

QueueSmart runs the **walk-in line for a primary-care provider office**. Patients
check in for a same-day visit from their phone, wait wherever they like, and
come in when told. Front-desk staff call patients forward, mark them checked
in or a no-show, and open or close each visit type. The office's business
rules are in section 9.

---

## 1. Install the tools (once per machine)

1. **Node.js 24 LTS** — https://nodejs.org. Verify in a terminal:
   ```bash
   node -v   # must print v24.3+ (recommended), v22.13+, or v26+
   npm -v
   ```
   Node 20 and older are blocked: `.npmrc` makes `npm install` stop with an
   `EBADENGINE` error, so everyone runs a Node version that Expo still
   supports. `.nvmrc` pins 24 for anyone using `nvm` / `fnm`.
2. **Git** — https://git-scm.com
3. **VS Code** — https://code.visualstudio.com
4. **Expo Go 57** on your phone — App Store or Google Play. This is how you test
   without installing Xcode or Android Studio. The project is pinned to
   **Expo SDK 57** (React Native 0.86) to match Expo Go **57.x**. Check the
   version under Settings in the Expo Go app: Expo Go only opens projects for
   the SDK it was built for. If your store copy has already moved to 58, the QR
   code will show an "incompatible SDK" error; the project then has to move
   to SDK 58 as well (section 8).

### VS Code extensions

Open the Extensions panel (`Ctrl/Cmd + Shift + X`) and install:

| Extension                                  | Why                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| **Expo Tools** (Expo)                      | Autocomplete for `app.json`, route awareness, Expo commands                 |
| **ES7+ React/Redux/React-Native snippets** | `rnfe` + Tab scaffolds a screen component                                   |
| **Prettier – Code formatter**              | Keeps formatting identical across the team, so diffs show real changes only |
| **ESLint**                                 | Catches unused imports and broken hooks before you run the app              |
| **GitLens**                                | Shows who wrote each line — useful when the TA asks about contributions     |

Then open VS Code settings (`Ctrl/Cmd + ,`), search "format on save", and turn
it on. Everyone on the team should do this, or Prettier will reformat each
other's files and inflate the diffs.

---

## 2. Create the project

Already done — skip straight to step 3. This section is kept only so the
history makes sense: the project was created with

```bash
npx create-expo-app@latest queuesmart-app
```

chosen with the **default template** (it ships `expo-router`, the file-based
navigation this codebase relies on). It uses `src/app/` as the routes folder
(not a bare `app/` folder), which is an Expo template option — the structure
in section 4 reflects that.

> **Known trap:** the command above was run from _inside_ a folder that was
> itself already called `queuesmart-app`, so on disk the real project lives
> two levels deep, at `queuesmart-app/queuesmart-app/`. That inner folder is
> the one with `package.json` — see step 3.

---

## 3. Clone and run

```bash
git clone <repo-url>
cd queuesmart-app/queuesmart-app        # note: two levels, see the trap above
npm ci
npx expo start
```

`npm ci` installs exactly the versions in `package-lock.json`, so everyone gets
an identical, known-good tree. Re-run it after every `git pull` that changed
`package.json` or `package-lock.json`. See section 8 before adding or upgrading
any package.

If you ever see:

```
ConfigError: The expected package.json path: ...\package.json does not exist
```

it means you're one folder too shallow (or too deep) — `cd` until `dir` /
`ls` shows a `package.json` in the current folder, then run `npx expo start`
from there.

### Start the app and the backend (A3)

The app gets all its data from the QueueSmart server in `server/`. The
easiest way to start both is the batch file in the project root:

.\start-all.bat

It opens two windows: **QueueSmart API** (the server on
http://localhost:4000) and **QueueSmart Expo** (the app). It installs the
server packages the first time it runs. Close those two windows to stop
everything.

If you prefer two terminals, start the server yourself and leave it running:

```bash
cd server
npm ci          # first time, and after server/package.json changes
npm run dev     # API on http://localhost:4000, restarts when you save
```

Then run `npx expo start` in a second terminal from the project root.

Demo accounts (in-memory, reset every time the server restarts):

| Role               | Email                     | Password       |
| ------------------ | ------------------------- | -------------- |
| Patient            | `patient@queuesmart.test` | `Patient#2026` |
| Front desk (admin) | `admin@queuesmart.test`   | `Admin#2026`   |

The app finds the server on its own: on web it uses the same host on port
4000, and in Expo Go it uses the laptop address from the QR code. If that
does not work (for example with `--tunnel`), set the address yourself before
`npx expo start`, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.20:4000`.

Run the backend tests with `cd server && npm test`, or `npm run
test:coverage` for the coverage report (`server/coverage/index.html`).

A QR code appears in the terminal. On your phone, open the **Camera app**
(iOS) or the **Expo Go** app (Android) and scan it, while your phone and
laptop are on the same Wi-Fi. Press `a` for an Android emulator or `w` for
web if you have them; there is no iOS simulator on Windows — use a physical
iPhone with Expo Go instead.

> On campus Wi-Fi, devices are often isolated from each other and the QR code
> will not connect. Run `npx expo start --tunnel` instead.

---

## 4. Project structure

````
queuesmart-app/queuesmart-app/         the actual Expo project (package.json lives here)
  src/
    app/                        FRONT END — screens. File-based routes: the folder path IS the URL
      _layout.js                 wraps every screen; holds the shared state provider
      index.js                   temporary dev landing page (delete once Login lands)
      admin/                     STAFF (front desk)
        (tabs)/                  tab bar group — the brackets are not part of the URL
          dashboard.js           → /admin/dashboard       front desk board: every line at a glance
          services.js            → /admin/services        visit types (list)
        services/
          [id].js                → /admin/services/new    add a visit type
                                 → /admin/services/s1     edit a visit type
        queue/
          [serviceId].js         → /admin/queue/s1        one line: call next, checked in, no-show
      user/                      PATIENTS
        dashboard.js             → /user/dashboard        check-in status + open visit types
        join-queue.js            → /user/join-queue       check in (reason for visit, 911 notice)
        queue-status.js          → /user/queue-status     my place in line, cancel check-in
        history.js               → /user/history          past visits
        profile.js               → /user/profile
    frontend/                   FRONT END — everything the screens share
      theme.js                   colours, spacing, type scale, urgency labels — import, do not hardcode
      checkInStatus.js           what the patient is told at each stage (shared by 3 screens)
      components/                Button.js, Field.js, Pill.js, QueueRow.js, Toast.js, ...
      hooks/useLayout.js         breakpoints
      state/ServicesStore.js     useServices() / useQueue() — what the screens read and call
    api/                        API CLIENT — the only code that talks to the server
      client.js                  request(): base URL, Bearer token, error handling
      auth.js                    register, login, changePassword
      services.js                listServices, createService, updateService, getStats, ...
      queue.js                   checkIn, cancelCheckIn, callNext, resolveCalled, ...
      notifications.js           listNotifications, markRead, markAllRead
  server/                       BACK END (A3) — separate Node + Express app, own package.json
    src/
      app.js                     the Express app; index.js starts it on port 4000
      api/                       "Back-end / API" box: routes, controllers, middleware,
                                 validation, business services (auth, services, queue,
                                 wait estimate, history, stats, officeRules)
      notifications/             "Notification component" box + MockSmsGateway ("SMS")
      database/                  "Database [SQL]" box for now: in-memory tables + repositories
    tests/                       Vitest unit + supertest API tests
  docs/                         A3 proposal, API spec, testing plan, change log

Calls only go downwards: **screens → frontend/state → src/api → (HTTP) → server**.
A screen never calls the server directly; it uses the hooks in `ServicesStore.js`. The screens live in
`src/app/` rather than inside `src/frontend/` because Expo Router requires
the routes folder to be there.

**Adding a screen:** create a file under `src/app/`. The path becomes the
route. `src/app/user/history.js` is reachable at `/user/history` with no
config.

**Navigating:**
```js
import { useRouter } from 'expo-router';
const router = useRouter();
router.push('/admin/services');   // go forward
router.back();                    // go back
````

---

## 5. Working as a team without conflicts

The four A2 screen groups touch different files, so parallel work is safe as
long as everybody follows this:

```bash
git checkout main
git pull
git checkout -b feature/admin-dashboard   # one branch per screen group
# ...work, committing as you go...
git add .
git commit -m "Add admin dashboard summary and service rows"
git push -u origin feature/admin-dashboard
```

Then open a pull request on GitHub and have a teammate review it.

Rules that prevent most merge pain:

- **Never commit directly to `main`.**
- **Commit often, in your own name.** The TA grades contribution from commit
  history, so four commits on the last night looks the same as no work.
- **`src/frontend/theme.js`, `src/frontend/state/ServicesStore.js` and
  `src/database/seed.js` are shared.** If you need a new colour or a new mock
  field, say so in the group chat before editing, or two people will change
  the same lines.
- All paths above are relative to `queuesmart-app/queuesmart-app/` (see
  section 4) — run every `git`/`npm`/`npx` command from inside that folder.
- Write commit messages that say what changed, not "update" or "fix".

Make sure `.gitignore` includes `node_modules/` and `.expo/`. The Expo template
adds these already — check before the first push, because committing
`node_modules` makes the repo unusable.

---

## 6. Taking the screenshots for the report

- iOS Simulator (macOS only): `Cmd + S`. Android emulator: camera button in
  the sidebar. On Windows there is no iOS simulator — use a physical iPhone
  with Expo Go instead.
- Physical phone: normal screenshot, then AirDrop or email it to yourself.
- Take each screen in a **clean state** — no keyboard open, no half-typed text
  — except the validation screenshot, where the errors are the point.
- For the Service Management screen, submit **two** screenshots: the empty form
  with validation errors showing, and a completed form. The rubric asks for
  validations and errors are the only way to show them.

---

## 7. What is deliberately not here

- No real database yet. The server keeps everything in memory, so data resets
  when the server restarts (A4 replaces `server/src/database/repositories/`).
- No real SMS. `MockSmsGateway` prints each text in the server terminal; the
  same alerts show in the app's notification bell.
- The app keeps your sign-in in memory only, so reloading the web page signs
  you out.

---

## 8. Dependencies and security

**Adding or upgrading packages.** Use `npx expo install <package>` instead of
`npm install <package>`. Expo picks the version that matches SDK 57 and what
Expo Go 57 ships natively; a mismatched native package usually crashes on
launch. **Do not bump `expo` to 58** unless every teammate's Expo Go has moved
to 58 too. After any change, run:

```bash
npx expo install --check   # every package matches the SDK
npx expo-doctor            # all checks should pass
```

**Never run `npm audit fix --force`.** It "fixes" the advisories below by
downgrading Expo to SDK 44 or jumping `expo-router` to SDK 58, and either one
breaks the app in Expo Go 57.

**Known `npm audit` result: 21 (18 high, 3 moderate), all from 3 advisories.**
`npm audit` lists every package that sits above a vulnerable one, so three
advisories show up as 21 lines.

| Advisory                                                                                                                                            | Where it comes from                                                   | Why it is accepted                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `braces` ≤3.0.3 — DoS from deeply nested glob patterns ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm))                   | Metro's file watcher on your laptop (`metro-file-map` → `micromatch`) | Metro only expands glob patterns from our own config, never from user input. 3.0.3 is the newest release, so no fix exists.                                                                                                 |
| `node-forge` ≤1.4.0 — RSA signature check is too lenient ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv))                 | `@expo/cli` code signing for `expo-updates`, on your laptop           | We don't use `expo-updates` or code signing. 1.4.0 is the newest release, so no fix exists.                                                                                                                                 |
| `decode-uri-component` ≤0.4.2 — slow decoding of malformed `%` sequences ([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)) | `expo-router` 57 → `query-string` 7, **in the app**                   | At worst, a malicious deep link could freeze the app on that one phone; no data is exposed. The only fix (0.5.0) is ESM-only and breaks `query-string` 7, so it can't be overridden. SDK 58's router drops this dependency. |

The first two clear once Expo or Metro ships a patched release; upgrading
within SDK 57 (`npx expo install expo@~57 --fix`) will pick that up. The third
clears when the project moves to SDK 58. Any **new** advisory beyond these
three should be looked at, not ignored.

**`overrides` in `package.json`.** `xcode` (used when building native iOS
projects) pins `uuid@7`, which has a moderate advisory
([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). The
override forces `uuid@^11.1.1` for `xcode` only. Do not widen it to `uuid@12+`:
those versions are ESM-only and break `xcode`'s `require('uuid')`. Remove the
override once `xcode` updates its own dependency.

**Why Reanimated and Worklets are listed even though no screen imports them.**
`expo-router` depends on `react-native-drawer-layout`, which requires them, so
npm installs them either way. Listing them pins them to the exact versions
Expo Go ships natively.

---

## 9. Provider office business rules

All of these live in `server/src/api/services/officeRules.js` (numbers and
wording) and `server/src/api/services/queueService.js` (enforcement). Change a
rule there, not in a screen. `src/frontend/rules.js` keeps a copy of the
numbers for instant form feedback; update it too.

**New in A3:** staff can mark a waiting patient **Urgent**, which moves them
ahead of everyone who is not urgent; patients of the same urgency stay in
arrival order.

| #   | Rule                                                                                                                                                                                                 | Where you see it                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **Visit types, not services.** Each has an expected duration, an urgency (Routine / Standard / Urgent) and a **daily capacity**.                                                                     | Staff › Visit types              |
| 2   | **Check-in needs a reason for the visit** (3–120 characters). Only staff see it.                                                                                                                     | Patient › Check in               |
| 3   | **One check-in at a time.** Cancel the current one to choose a different visit type.                                                                                                                 | Patient › Check in               |
| 4   | **Check-in closes automatically when a line is full** (waiting ≥ capacity). Capacity can't be set below the number already in line.                                                                  | "Full for today" / "Full" tags   |
| 5   | **Not for emergencies.** A 911 notice appears wherever a patient checks in.                                                                                                                          | Patient › Dashboard, Check in    |
| 6   | **Status follows your place in line:** _Waiting_ → _Head to the office_ once 2 or fewer patients are ahead → _It is your turn_ when called.                                                          | Patient › Dashboard, My check-in |
| 7   | **Front desk flow:** _Call next patient_ → _Checked in_ (name + date of birth confirmed at the desk) or _No-show_ after a 10-minute grace period. Only one patient per line can be called at a time. | Staff › line screen              |
| 8   | **Privacy:** lists show first name + last initial ("Maria G."). Notifications never include the reason for the visit, because they can appear on a lock screen.                                      | Everywhere                       |
| 9   | **Closing a visit type stops new check-ins only.** Patients already in line keep their place.                                                                                                        | Staff › Front desk toggles       |
| 10  | **A visit type can't be deleted while anyone is in its line** (or being called). Close it and let the line clear first.                                                                              | Staff › Edit visit type          |

Registration asks for **full legal name and date of birth**, the two
identifiers the front desk checks against a photo ID.

**To demo the whole loop** in one session (data is in memory, so don't reload
the page): register a patient → check in for _Minor Injury_ → Profile › Log out
→ _Office staff sign in_ → open _Minor Injury_ → call next until the patient
is called → back out to the patient sign-in and log in again: the dashboard
says _It is your turn_ → back to staff → _Checked in_ → the patient's visit
history shows _Seen_.

Kept out on purpose, to keep A2 simple: same-day rescheduling, appointment
times, insurance capture, SMS (A1's external system), and automatic no-show
timers. The 10-minute grace period is guidance for staff, not a timer.
