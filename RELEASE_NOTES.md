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
