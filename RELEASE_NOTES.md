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
