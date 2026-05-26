# SetFuel Release Notes

This file tracks app releases in one place so publishing is easy later.

## Versioning rules

- `expo.version` in `mobile/app.json` = human-readable app version (`1.0.0`, `1.1.0`, etc.)
- `expo.android.versionCode` in `mobile/app.json` = Android internal build number (must increase for upgrades)
- App display name on Android home screen = `expo.name` in `mobile/app.json`

## Release template

Copy this section for each new version:

```md
## [x.y.z] - YYYY-MM-DD

### Build metadata
- App display name: SetFuel
- Version (`expo.version`): x.y.z
- Android versionCode: N
- EAS profile: preview | production

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Notes
- Install / rollout notes
- Known issues
```

---

## [1.2.2] - 2026-05-27

### Build metadata
- **Date:** 2026-05-26
- **App display name:** SetFuel
- **Scope:** Mobile + backend.
- **Current mobile app (`expo.version`):** 1.2.0
- **Current Android versionCode:** 3

### Added
- **Client timezone forwarding from mobile** — history, meals, session list, and dashboard-summary requests now send the device timezone / offset so backend date-based queries can be evaluated in the user’s local day.
- **Workout program card actions** — each program card now has its own Start / End control with a confirmation modal before beginning or ending a workout.
- **Program-start auto load flow** — starting a workout from a program card now loads that program’s exercises into the active session automatically.

### Changed
- **Local auth mode in dev builds** — `EXPO_PUBLIC_USE_LOCAL=true` now bypasses Google login in native Expo dev builds too, not just Expo Go, while EAS release profiles can still explicitly force normal auth.
- **History calendar UX** — only days with logged workout or meal data are tappable, and the screen copy now reflects that behavior.
- **Workout screen session UX** — the generic bottom start area is now a passive hint card, and when programs exist it tells the user to start from the relevant program card.
- **Routine modal guidance** — the old “Add all to session” action was removed in favor of guidance that explains the new program-start flow.
- **Program editing controls** — repeated taps on “Add section” and “Add exercise line” no longer stack empty placeholders.

### Fixed
- **Timezone-related history bugs** — workout / meal entries and calendar dots now land on the correct local day for non-UTC users instead of drifting to the previous day.
- **Workout program race condition** — rapid taps no longer slip past the program-load guard and duplicate exercises in the active session.
- **Program card state leakage** — starting one program no longer flips every card into the active “End” state; only the loaded program reflects the running session.
- **Workout CTA alignment** — the program card action icon and text now align cleanly, and the bottom “Start workout” hint keeps its icon/title layout intact.
- **Active session / program sync** — when a workout is started from a program card, manual `Add exercise` actions now update both the active session and the currently loaded program; saving new exercise lines on that active program also syncs them into the running session.

### Notes
- **Release status:** This section tracks work completed after `1.2.1` and should be converted into a numbered release once you decide the next app version / build number.
- **Mobile rebuild:** No new native dependency was added in this batch; these are JavaScript / TypeScript and backend behavior changes.

---

## [1.2.1] - 2026-05-13

### Build metadata
- **Scope:** Backend + hosting (no mandatory new mobile APK for these changes).
- Mobile app (`expo.version`): still **1.2.0** / Android **versionCode** 3 until you ship a build that points production traffic at the new API URL.

### Added
- **Production PostgreSQL on Neon** — managed Postgres hosts the SetFuel schema; connection string supplied to the backend as `DATABASE_URL` (pooled endpoint recommended for serverless-style hosts).
- **Production API on Render** — Node web service runs the compiled backend (`npm run build` → `npm start`), with environment variables for DB, JWT, Google OAuth, and logging.
- **Live deployments** — database and API are deployed and reachable from clients configured with the public Render base URL.

### Changed
- **Backend `package.json`** — `typescript` and `@types/cors`, `@types/express`, `@types/jsonwebtoken`, `@types/node`, and `@types/pg` moved from `devDependencies` to **`dependencies`** so Render’s production install (which often skips dev dependencies) still installs everything **`tsc`** needs.
- **`backend/tsconfig.json`** — `compilerOptions.types` set to **`["node"]`** so Node globals (`process`, `node:fs`, `node:crypto`, etc.) typecheck consistently in CI and on Render.

### Fixed
- **Render build failure (`TS7016` / `TS2591` / implicit `any` on Express handlers)** — caused by missing `@types/*` and `typescript` when `npm install` ran without dev dependencies; resolved by the dependency and tsconfig changes above.

### Notes
- **Mobile:** set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` (and EAS secrets for release builds) to your **Render service URL** (e.g. `https://<service>.onrender.com`) so the app talks to the live API.
- **Render:** configure `DATABASE_URL` (Neon), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and any other vars from `backend/.env.example`; run migrations against Neon (`npm run db:migrate` with env pointing at Neon, or equivalent) before relying on production data paths.
- **Neon:** use the project’s connection string from the Neon dashboard; prefer the **pooled** connection if Render’s docs recommend it for `pg`.

---

## [1.2.0] - 2026-05-04

### Build metadata
- App display name: SetFuel
- Version (`expo.version`): 1.2.0
- Android versionCode: 3
- EAS profile: preview APK

### Added
- **Google Sign-In (real OAuth 2.0)** — native Google account picker replaces the placeholder button. Users sign in with their real Google account on the first launch and are remembered on return visits.
- **JWT authentication** — backend issues a signed 7-day application JWT on every successful sign-in. All protected `/v1` routes now verify a real Bearer token instead of the dev stub.
- **`POST /auth/google` endpoint** — verifies the Google ID token server-side via `google-auth-library`, upserts the user in `app_user` (email, display name, avatar, Google ID), and returns the app JWT.
- **Session persistence** — JWT is stored securely in `expo-secure-store`. On every cold start the token is validated against the backend and the session is silently restored; only an expired or revoked token returns the user to the login screen.
- **User profile in auth context** — `useAuth()` now exposes `user: { id, email, displayName, avatarUri }` in addition to `isSignedIn`.
- **Profile modal on all main tabs** — tapping the avatar in the header on Home, Diet, and Workout opens the same profile bottom sheet everywhere, with a sign-out action.
- **Backend structured logging with `pino`** — pretty-printed and colour-coded in development (DEBUG level), structured JSON in production (INFO level). Every log line is tagged with `{ module }` for easy filtering.
  - HTTP layer: method, URL, status code, response time, user-agent, and IP logged on every request; health-check polls suppressed.
  - Auth layer: step-by-step trace from Google token verification through user upsert to JWT issuance.
  - All v1 route handlers wrapped in try/catch with structured error objects — no more silent crashes on DB failures.
  - DB pool: creation, connect, remove, and idle-client error events logged.
  - Startup summary shows configured/missing state of `DATABASE_URL`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID`.
  - Global error handler catches any unhandled route errors and logs them before returning a clean 500 response.

### Changed
- `requireUser` middleware replaced with real JWT Bearer verification — returns `401 Unauthorized` for missing, invalid, or expired tokens (was always resolving to the first `app_user` row).
- `AuthContext` fully rewritten: real `GoogleSignin.signIn()` flow, SecureStore persistence, session restore on mount, async `signOut` that clears storage and revokes the Google session.
- `RootNavigator` renders a blank view during the session-restore check to prevent a flash of the Login screen on cold start for already-signed-in users.
- Login screen updated: loading spinner replaces the button icon during sign-in, inline error banner shown on failure, headline updated from "Authentication Coming Soon" to live copy.
- `signOut` is now async across all call sites (Home, Diet, Workout screens).
- Program routine sheet restructured: only the blocks list scrolls; name/day fields, Add section, and Cancel/Save buttons are pinned in a fixed footer with safe-area padding.

### Fixed
- Network error on sign-in now surfaces the exact backend URL attempted (`Cannot reach backend at <url>`) instead of the generic "Network request failed" message.
- Added guard for unconfigured `AUTH_BASE_URL` — shows a clear message if `EXPO_PUBLIC_API_BASE_URL` is missing from `.env`.
- Fixed `react-native-worklets` peer dependency required by Reanimated 4.x; missing package caused `TurboModule installTurboModule` arity errors on Android startup.
- Added `.idea/` to `.gitignore` to prevent Android Studio IDE metadata from being accidentally committed.

### Notes
- **Requires a full rebuild** (`npx expo run:android` or EAS build) — this release adds native modules (`@react-native-google-signin/google-signin`, `expo-secure-store`) that cannot be loaded over-the-air.
- Run `npm run db:migrate` in `backend/` before deploying — migration `003_google_auth.sql` adds the `google_id` column to `app_user`.
- Set `JWT_SECRET` (generate with `openssl rand -hex 64`) and `GOOGLE_CLIENT_ID` (Web application client from Google Cloud Console) in `backend/.env` before starting the server.

---

## [1.1.0] - 2026-04-21

### Build metadata
- App display name: SetFuel
- Version (`expo.version`): 1.1.0
- Android versionCode: 2
- EAS profile: preview APK

### Added
- Backend service (`backend/`) with Express + PostgreSQL (`pg`) and typed TypeScript build/start scripts.
- `/v1` REST API surface for user profile/dashboard summary, workouts (sessions/exercises/sets/programs), and meals.
- SQL migration runner plus baseline schema/data migrations under `backend/sql`.
- API-ready mobile service layer and shared app types for cleaner backend integration.
- Environment-based mobile API config (`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_USE_LOCAL`) with backend mode support.
- Nix-based local development setup for Node/Postgres parity across machines.
- Home screen rotating wellness tips card with timed transition animation.

### Changed
- UI theming migrated to design-token driven palettes (including dark auth/dashboard treatment) for consistent styling.
- Main navigation and screen structure refined with shared `AppHeader` and improved tab/dashboard presentation.
- Workout tracker upgraded with better session state handling, program persistence/editing, and API integration paths.
- Diet tracker and Home dashboard now include stronger loading/error states and retry handling.
- NativeWind/Tailwind integration added and aligned with project color tokens for hybrid styling support.
- Android build setup improved with EAS config updates and AsyncStorage Maven repo plugin support.

### Fixed
- Addressed Expo SDK / dependency alignment and TypeScript config issues impacting local/dev builds.
- Improved failure handling when dashboard/diet API calls fail (clearer fallback and recovery behavior).
- Resolved several workout/diet UI regressions introduced during design system migration.

### Notes
- Auth is still placeholder-only: backend resolves the first `app_user` row (`dev@local.test`) for protected routes.
- Auth still uses placeholder flow; plan Google OAuth/JWT before a full production rollout.

## [1.0.0] - 2026-03-31

### Build metadata
- App display name: SetFuel
- Version (`expo.version`): 1.0.0
- Android versionCode: 1
- EAS profile: preview APK

### Added
- Expo React Native app shell with TypeScript.
- Login screen + Home dashboard + Workout + Diet tabs.
- Workout local logging: start session, add exercises/sets, edit reps/kg.
- Diet local logging: log meal, quick add, running calorie total.
- Personal routines dataset and routine modal with "Add all to session".
- EAS preview build pipeline for standalone Android APK installs.

### Changed
- Pinned project to Expo SDK 54 for Expo Go compatibility on Android Play Store builds.

### Fixed
- Resolved Expo Go SDK mismatch issue by aligning SDK/app dependencies.
- Resolved tsconfig base lookup by using explicit Expo tsconfig path.

### Notes
- This is the first usable gym-ready build installable as an APK.
- Backend/auth persistence still pending; data is currently local-state only.
