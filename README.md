# SetFuel

**SetFuel** is a monorepo for a production-minded React Native app (Android first) that tracks **daily workouts** and **diet**. The name pairs **sets** (training) with **fuel** (nutrition)—short and memorable.

> Alternatives you might like: **RepDay**, **LiftPlate**, **DayStride**.

## Current status (Step 1 — UI shell)

- Expo **SDK 54** (React Native) app under `mobile/` with TypeScript — matches typical **Expo Go from the Play Store** (see decisions below)
- Placeholder **Google Sign-In** UI → toggles auth via `AuthContext` (no OAuth yet)
- **Bottom tabs**: Home (dashboard), Workout, Diet
- Shared **theme** (`colors`, `spacing`) and small **UI primitives** (`Card`, `PrimaryButton`)
- `backend/` reserved for Node + PostgreSQL next

## Prerequisites

- [Node.js](https://nodejs.org/) LTS (18+ recommended)
- [npm](https://www.npmjs.com/) (ships with Node)
- For Android: [Android Studio](https://developer.android.com/studio) + emulator or USB device with debugging
- [Expo Go](https://expo.dev/go) on a physical device (optional quick preview)

## Setup

```bash
cd mobile
npm install
npx expo start
```

Then press `a` for Android emulator, or scan the QR code with Expo Go.

**If Expo Go says the project is incompatible:** the app’s **Expo SDK** must match the **native Expo Go** build. This repo targets **SDK 54** so a normal Play Store Expo Go install should work. After changing SDK, stop Metro (`Ctrl+C`), run `npx expo start` again, and reload the app in Expo Go.

### Run Android directly

```bash
cd mobile
npm run android
```

## Folder structure

```text
setfuel/
├── README.md                 # This file — setup, features, structure, decisions
├── backend/                  # Node + Postgres (coming later)
│   └── README.md
└── mobile/                   # Expo React Native app
    ├── App.tsx               # SafeAreaProvider, AuthProvider, NavigationContainer
    ├── app.json              # Expo app name/slug: SetFuel / setfuel
    ├── assets/
    └── src/
        ├── components/ui/    # Reusable presentation components
        ├── context/          # Auth (placeholder until Google + API)
        ├── navigation/       # Root stack + main tabs + route types
        ├── screens/
        │   ├── auth/         # Login (Google placeholder)
        │   ├── diet/         # Diet tracker shell
        │   ├── home/         # Dashboard
        │   └── workout/      # Workout tracker shell
        └── theme/            # Design tokens
```

## Features added (changelog-style)

| Step | What |
|------|------|
| **1** | Expo TS app, navigation shell, Login + Home + Workout + Diet UIs, theme tokens, auth placeholder |
| **1b** | Downgraded to **Expo SDK 54** so physical devices using Play Store Expo Go avoid “requires newer Expo Go” (SDK 55 mismatch) |
| **2** | **Workout**: start session, add exercises (modal), log sets (reps / kg), remove sets/exercises · **Diet**: log meal / quick-add modal, live calorie total, remove meal · **`TextField`** UI primitive |

## Key decisions

| Topic | Choice | Why |
|--------|--------|-----|
| **Framework** | **Expo** | Managed native tooling, fast iteration, straightforward Android builds; easy to add dev client later for custom native modules (e.g. Google Sign-In). |
| **Expo SDK** | **54** (not 55) | **Expo Go** from the Play Store often lags the newest SDK; SDK 54 matches what most users get without sideloading. Upgrade to 55+ when your Expo Go shows SDK 55 or you switch to a **development build**. |
| **Navigation** | **React Navigation** (native stack + bottom tabs) | De facto standard; maps well to “auth screen vs main app” and tabbed main sections. |
| **UI-first** | Placeholder auth + mock lists | Validates information architecture and UX before investing in API design. |
| **State** | `AuthContext` for sign-in flag only | Minimal global state; feature data will likely use server cache (TanStack Query, etc.) after the backend exists. |
| **Database (planned)** | **PostgreSQL** | Relational model fits users, workouts, sets, meals, and dates; excellent with Node. SQLite is an alternative for offline-first later—not a replacement for a sync server if you want multi-device. |

## React vs React Native (mental model)

- **Layout**: Flexbox is the default; there is no browser DOM—`View` ≈ `div`, `Text` must wrap strings.
- **Styling**: `StyleSheet` objects, not separate CSS files (unless you add a library).
- **Press targets**: Prefer `Pressable` (or `TouchableOpacity`) over expecting a native `<button>`.
- **Navigation**: Screen flow is explicit (stack/tabs), not URL-first like React Router—though deep linking can align them later.

## Next steps (suggested order)

1. **Forms & lists** — add workout set logging UI and meal entry modals (still local state).
2. **Backend skeleton** — Express/Fastify + Postgres schema for users, sessions, workouts, meals.
3. **Google Sign-In** — `expo-auth-session` or `@react-native-google-signin/google-signin` + server token verification.
4. **Persistence on device** — optional SQLite/WatermelonDB for offline drafts synced to API.

---

*Update this README after each major milestone (features, commands, or structural changes).*
