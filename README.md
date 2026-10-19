# QueueSmart — Mobile App (Assignment 2)

React Native + Expo. Runs on Android and iOS from one codebase.

---

## 1. Install the tools (once per machine)

1. **Node.js 24 LTS** — https://nodejs.org. Verify in a terminal:
   ```bash
   node -v   # must print v24.3+ (recommended), v22.13+, or v26+
   npm -v
   ```
   Node 20 and older will **not** work: React Native 0.88 requires 22.13+, and
   `.npmrc` makes `npm install` stop with an `EBADENGINE` error on older
   versions. `.nvmrc` pins 24 for anyone using `nvm` / `fnm`.
2. **Git** — https://git-scm.com
3. **VS Code** — https://code.visualstudio.com
4. **Expo Go** on your phone — App Store or Google Play. This is how you test
   without installing Xcode or Android Studio. The project is on **Expo SDK 58**;
   the store version of Expo Go only runs the newest SDK, so keep the app updated.

### VS Code extensions

Open the Extensions panel (`Ctrl/Cmd + Shift + X`) and install:

| Extension | Why |
|---|---|
| **Expo Tools** (Expo) | Autocomplete for `app.json`, route awareness, Expo commands |
| **ES7+ React/Redux/React-Native snippets** | `rnfe` + Tab scaffolds a screen component |
| **Prettier – Code formatter** | Keeps formatting identical across the team, so diffs show real changes only |
| **ESLint** | Catches unused imports and broken hooks before you run the app |
| **GitLens** | Shows who wrote each line — useful when the TA asks about contributions |

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

> **Known trap:** the command above was run from *inside* a folder that was
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

A QR code appears in the terminal. On your phone, open the **Camera app**
(iOS) or the **Expo Go** app (Android) and scan it, while your phone and
laptop are on the same Wi-Fi. Press `a` for an Android emulator or `w` for
web if you have them; there is no iOS simulator on Windows — use a physical
iPhone with Expo Go instead.

> On campus Wi-Fi, devices are often isolated from each other and the QR code
> will not connect. Run `npx expo start --tunnel` instead.

---

## 4. Project structure

```
queuesmart-app/queuesmart-app/         the actual Expo project (package.json lives here)
  src/
    app/                        FRONT END — screens. File-based routes: the folder path IS the URL
      _layout.js                 wraps every screen; holds the shared state provider
      index.js                   temporary dev landing page (delete once Login lands)
      admin/
        (tabs)/                  tab bar group — the brackets are not part of the URL
          dashboard.js           → /admin/dashboard
          services.js            → /admin/services        (list)
        services/
          [id].js                → /admin/services/new    (create)
                                 → /admin/services/s1     (edit)
        queue/
          [serviceId].js         → /admin/queue/s1        (placeholder, teammate-owned)
      user/
        join-queue.js            → /user/join-queue
        queue-status.js          → /user/queue-status
    frontend/                   FRONT END — everything the screens share
      theme.js                   colours, spacing, type scale — import, do not hardcode
      components/                Button.js, Field.js, Pill.js, QueueRow.js, Toast.js, ...
      hooks/useLayout.js         breakpoints
      state/ServicesStore.js     useServices() / useQueue() — what the screens read and call
    api/                        API — the only thing the front end imports from the layers below
      services.js                listServices, createService, updateService, ...
      queue.js                   getActiveQueue, joinQueue, leaveQueue
    backend/                    BACK END — business rules
      servicesService.js
      queueService.js
      waitEstimate.js            the wait-time model from A1
    database/                   DATABASE — in-memory tables for A2
      db.js                      all / find / insert / update / remove
      seed.js                    starting rows
```

Calls only go downwards: **screens → frontend/state → api → backend → database**.
A screen never imports from `backend/` or `database/`. The screens live in
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
```

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

- No server, no network calls. `src/backend/` and `src/database/` run inside
  the app and hold everything in memory, so data resets when the app reloads.
  That is expected for A2. In A3 the function bodies in `src/api/` become
  network requests and the screens stay as they are.
- No authentication logic. The login screen validates input only.
- No push notifications yet. In-app notification display is A2 scope.

---

## 8. Dependencies and security

**Adding or upgrading packages.** Use `npx expo install <package>` instead of
`npm install <package>`. Expo picks the version that matches SDK 58 and what
Expo Go ships natively; a mismatched native package usually crashes on launch.
After any change, run:

```bash
npx expo install --check   # every package matches the SDK
npx expo-doctor            # 20/20 checks should pass
```

**Never run `npm audit fix --force`.** It "fixes" the advisories below by
downgrading Expo to SDK 44 and React Native to 0.72, which breaks everything.

**Known `npm audit` result: 19 high, all from 2 advisories with no upstream fix.**
`npm audit` lists every package that sits above a vulnerable one, so two
advisories show up as 19 lines. Both are in development tooling (the Expo CLI
and the Metro bundler on your laptop). Neither is shipped in the app bundle
that runs on the phone.

| Advisory | Where it comes from | Why it doesn't affect this project |
|---|---|---|
| `braces` ≤3.0.3 — DoS from deeply nested glob patterns ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) | Metro's file watcher (`metro-file-map` → `micromatch`) | Metro only expands glob patterns from our own config, never from user input. 3.0.3 is the newest release. |
| `node-forge` ≤1.4.0 — RSA signature check is too lenient ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)) | `@expo/cli` code signing for `expo-updates` | We don't use `expo-updates` or code signing. 1.4.0 is the newest release. |

Once Expo or Metro ships a release that drops or patches these, upgrading
within SDK 58 (`npx expo install expo@~58 --fix`) will clear them. Any **new**
advisory beyond these two should be looked at, not ignored.

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
