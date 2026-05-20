# SetFuel — Project Status Report

**Generated:** 2026-05-20  
**Scope:** `mobile/` + `backend/` evaluated against the stated product goal: complete workout + calorie tracking with persistent history, session/day stats, and long-term progress analysis.

**Evaluation method:** Code and schema inspection only. Features are marked complete only when they work **end-to-end** (UI → service → API → database → reload) in **API mode** (`EXPO_PUBLIC_USE_LOCAL=false`), unless noted otherwise.

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Overall completion (vs. full stated goal)** | **~48%** |
| **Production-ready slice (sign in + log today’s workout + log meals to cloud)** | **~70%** |
| **Core gap** | **No workout history UI/API, no calories-burned tracking, weak analytics, diet “daily” semantics inconsistent on mobile** |

The project has moved well beyond a UI shell: **live auth**, **hosted API (Render)**, **Neon Postgres**, and **real CRUD** for active workouts, programs, and meals exist. What is **not** yet delivered is the **retrospective layer** (browse past sessions, trends, session/day analytics) and **expenditure (burned) calories**, which are central to the stated goal.

---

## Goal mapping

| Stated goal | Status | Notes |
|-------------|--------|-------|
| Track workouts per gym session | **Mostly done (active session)** | Start/end session, exercises, sets, reps/kg, done toggle; persisted to `workout_session` when API mode |
| Track calories **intake** per day | **Partial** | Meals CRUD + server daily summary exist; Diet tab totals **all meals ever** in API mode, not “today only” |
| Track calories **burned** per session/day | **Not started** | No schema, API, or UI |
| View workout **history** anytime | **Not done** | Sessions stored on end; **no list/detail API or screen** |
| Persistent historical fitness data | **Partial** | DB retains ended sessions + meals; **no read path for workouts** in app |
| Analyze progress (logs, summaries, stats) | **Minimal** | Home dashboard: `lastWorkoutDaysAgo`, today kcal vs goal; no charts, volume, PRs, or session stats |

---

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  mobile (Expo SDK 54, React Navigation, AuthContext)            │
│  Screens: Login, Home, Workout, Diet                            │
│  Services: workoutService, mealService, userService, api.ts    │
│  Toggle: USE_LOCAL → in-memory / AsyncStorage vs apiFetch       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS + Bearer JWT (when USE_LOCAL=false)
┌───────────────────────────▼─────────────────────────────────────┐
│  backend (Express, TypeScript, pino)                            │
│  POST /auth/google  ·  GET /health  ·  /v1/* (requireUser)    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ pg
┌───────────────────────────▼─────────────────────────────────────┐
│  PostgreSQL (Neon) — app_user, workout_program,                 │
│  workout_session (JSONB exercises), meal                        │
└─────────────────────────────────────────────────────────────────┘
```

**State management:** No global server cache (e.g. TanStack Query). Each screen loads with `useEffect`; Workout tab debounces set/exercise patches (~550ms) to API. Auth token in memory (`api.ts`) + `expo-secure-store`.

**Session model:** One **active** open session per user (`ended_at IS NULL`). Ending a session writes `ended_at`; exercise data lives in **`exercises` JSONB** on that row (not normalized `set` rows).

---

## Module-wise completion

| Module | Completion | E2E in API mode? |
|--------|------------|------------------|
| Authentication & identity | **88%** | Yes (Google → JWT → profile) |
| Active workout session | **82%** | Yes |
| Workout programs / routines | **78%** | Yes (API); local uses AsyncStorage |
| Meal / calorie **intake** | **65%** | CRUD yes; daily UX inconsistent |
| Calorie **burned** | **0%** | N/A |
| Workout **history** & retrieval | **12%** | Data written, not readable in app |
| Progress / analytics | **22%** | Dashboard summary only |
| Infrastructure (Render, Neon, EAS) | **85%** | Deployed; migrations manual |
| Documentation accuracy | **40%** | README/ARCHITECTURE lag code |

---

## 1. Completed features (functional E2E where applicable)

### Authentication & user-specific data
- **Google Sign-In** on native builds (EAS APK / dev client); `POST /auth/google` verifies ID token, upserts `app_user`, returns JWT.
- **`requireUser` middleware** — Bearer JWT on all `/v1` routes.
- **Session restore** — JWT in SecureStore; profile validated on cold start via `GET /v1/user/profile`.
- **Per-user rows** — `user_id` on `workout_program`, `workout_session`, `meal`.

### Active workout tracking (API mode)
- `POST /sessions` start (auto-closes stale open session).
- `GET /sessions/active` + mobile resume on load.
- `POST /sessions/:id/end` end session.
- Exercises: add (`POST /sessions/:id/exercises`), rename, delete.
- Sets: add, patch (reps, weightKg, done), delete, toggle done.
- Mobile Workout screen wires the above with optimistic UI + debounced sync.

### Programs (API mode)
- Full CRUD: `GET|POST /programs`, `PUT|DELETE /programs/:id`.
- Seed-from-bundled-routines helper in `workoutService.replaceProgramsWithBundledSamples()`.

### Meal intake (API mode)
- `GET|POST /meals`, `DELETE /meals/:id`.
- `GET /meals/daily-summary` (today UTC, macros, goal from `app_user.goal_kcal`).

### Dashboard (API mode)
- `GET /v1/user/dashboard-summary` — today kcal, goal, nutrition progress, macros, days since last ended workout.

### Operations
- Health: `/health`, `/health/db`.
- Migrations: `sql/001_init.sql`, `002_api_core.sql`, `003_google_auth.sql` + `npm run db:migrate`.
- Production: Render API + Neon DB; EAS preview APK with live `EXPO_PUBLIC_API_BASE_URL`.

---

## 2. Partially implemented

| Area | What works | What’s missing / broken |
|------|------------|-------------------------|
| **Diet “daily” tracking** | Server `daily-summary` is correct for **today** | Diet screen uses `GET /meals` (all time) and sums **all** rows for ring/total; hardcodes `DAILY_GOAL_KCAL = 2500` instead of `getDailySummary()` |
| **Calorie intake history** | All meals stored with `created_at` | No date picker, no “previous days” view, list grows unbounded in UI |
| **Workout persistence** | Ended sessions saved with full JSON snapshot | No `GET /sessions` history, no session detail, no search by date |
| **Progress stats** | `lastWorkoutDaysAgo` on Home | No volume (sets×reps×kg), frequency, streaks, or exercise PRs |
| **User goals** | `goal_kcal` in DB, used by dashboard API | No API/UI to edit goal; mobile ignores server goal on Diet tab |
| **Programs (local mode)** | AsyncStorage via `routinesStorage.ts` | Diverges from API programs; empty default until user seeds |
| **Offline / dual mode** | `USE_LOCAL` switch in services | Two behaviors to test; easy to ship wrong env in a build |
| **Docs** | RELEASE_NOTES 1.2.x accurate for auth/hosting | README/ARCHITECTURE still describe “placeholder auth” and “backend later” |

---

## 3. Missing features (critical for stated goal)

1. **Workout history API** — e.g. `GET /sessions?from=&to=`, `GET /sessions/:id` for completed sessions.
2. **Workout history UI** — calendar/list, session detail (read-only), compare days.
3. **Session-wise workout stats** — duration, exercise count, sets completed, volume, per-session summary.
4. **Calories burned** — model (estimate or manual), per session and daily rollup.
5. **Long-term analytics** — weekly/monthly trends, charts, personal records.
6. **Daily workout + diet views aligned** — filter by date; timezone-aware “today” on mobile.
7. **Profile/settings API** — update `goal_kcal`, display name, avatar.
8. **Normalized workout schema (optional but scalable)** — exercises/sets as tables vs single JSONB blob for SQL aggregates.
9. **Automated tests** — no API or mobile integration tests observed.
10. **CI** — not verified in this review.

---

## 4. Backend status

### API completeness (implemented routes)

| Domain | Routes | History / analytics |
|--------|--------|---------------------|
| Auth | `POST /auth/google` | — |
| User | `GET /user/profile`, `GET /user/dashboard-summary` | Summary only |
| Programs | CRUD `/programs` | — |
| Sessions | `GET /active`, `POST /`, `POST /:id/end`, `POST /:id/exercises` | **No list past sessions** |
| Exercises | `DELETE|PATCH /:id`, `POST /:id/sets` | Active session only |
| Sets | `DELETE|PATCH /:id`, `POST /:id/toggle` | Active session only |
| Meals | `GET|POST /`, `DELETE /:id`, `GET /daily-summary` | No meals-by-date range |

### Database readiness

| Table | Purpose | Readiness |
|-------|---------|-----------|
| `app_user` | Identity, `goal_kcal`, `google_id`, avatar | **Good** for auth + goals |
| `workout_program` | User templates (`blocks` JSONB) | **Good** |
| `workout_session` | Sessions + nested exercises JSONB | **Good for write**; **poor for analytics queries** |
| `meal` | Intake log | **Good**; index on `(user_id, created_at)` |

**Gaps:** No `calories_burned`, `session_stats`, or normalized `exercise`/`set` tables. No DB-level constraints on JSONB shape beyond application code.

### Auth & security (practical)
- JWT + Google verification: **production-viable** for personal app.
- CORS open; no rate limiting; no refresh tokens (7-day JWT per auth route).
- Render cold starts may cause slow first request (operational, not code bug).

---

## 5. Mobile app status

### Screens

| Screen | Role | API integration |
|--------|------|-----------------|
| `LoginScreen` | Google / Expo Go offline path | **E2E** on EAS APK |
| `HomeScreen` | Dashboard summary + tips | **E2E** for profile + summary when API mode |
| `WorkoutTrackerScreen` | Programs carousel + active session | **E2E** for session CRUD; **no history tab** |
| `DietTrackerScreen` | Meal list + log modal | **E2E** CRUD; **daily totals wrong** in API mode |

### Services (`USE_LOCAL=false`)

| Service | API wired? |
|---------|------------|
| `workoutService` | **Yes** — full active-session + programs |
| `mealService` | **Yes** — meals CRUD; `getDailySummary()` **unused** by Diet screen |
| `userService` | **Yes** — profile + dashboard summary |
| `routinesStorage` | Local only (not used in API mode for programs) |

### Production build path
- `eas.json` sets `EXPO_PUBLIC_USE_LOCAL=false` and Render `/v1` URL for preview/production.
- Confirmed user path: EAS APK + GCP Android SHA-1 + live sign-in.

---

## 6. API integration status

| Flow | Status |
|------|--------|
| Sign-in → store JWT → attach `Authorization` on `apiFetch` | **Complete** |
| Workout start → mutate → end → data in Neon | **Complete** |
| Reload app → resume active session | **Complete** |
| Reload app → see past workouts | **Not integrated** |
| Diet log → persists → correct “today” total on Diet tab | **Incomplete** (uses full meal list) |
| Home dashboard after workout/meal | **Mostly complete** (workout recency + today nutrition) |

---

## 7. Verification against specific requirements

### Workout session tracking
- **Active session:** Complete E2E.
- **Ended sessions:** Persisted, not browsable.

### Exercise logging
- **Complete** for active session (name, sets, reps, kg, done).

### Calories tracking
- **Intake:** Log + delete + server storage — **yes**; daily accuracy on mobile — **no**.
- **Burned:** **Not implemented.**

### Historical workout retrieval
- **Backend:** No list endpoint.
- **Mobile:** No UI.

### User progress / stats analytics
- **Minimal:** days since last workout, today kcal vs goal on Home.
- **Missing:** session stats, trends, burned vs intake, exercise history.

### CRUD operations

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| Programs | ✓ | ✓ | ✓ | ✓ | |
| Active workout | ✓ | ✓ (active) | ✓ (via exercises/sets) | ✓ (end session) | |
| Past workout | ✓ (implicit on end) | ✗ | ✗ | ✗ | |
| Meals | ✓ | ✓ (all) | ✗ | ✓ | No meal edit |
| User profile | ✓ (auth upsert) | ✓ | ✗ | ✗ | |

### Daily history / long-term progress

| Capability | Supported? |
|------------|------------|
| Daily workout history | **No** (UI) |
| Session-wise stats | **No** |
| Long-term progress tracking | **No** (only coarse dashboard fields) |
| Persistent storage | **Yes** (server) |
| Real-time sync during session | **Yes** (debounced PATCH) |

---

## 8. Bugs / issues found

| Severity | Issue |
|----------|--------|
| **High** | Diet screen totals use **all meals** from `GET /meals`, not today — misreports daily intake in API mode. |
| **High** | Diet screen ignores `GET /meals/daily-summary` and server `goal_kcal`; uses hardcoded `2500`. |
| **High** | No workout history API/UI despite data being saved on session end. |
| **Medium** | `DashboardSummary` type omits `macros` returned by API (unused on Home). |
| **Medium** | README / ARCHITECTURE outdated vs implemented backend and auth. |
| **Medium** | `USE_LOCAL` defaults **true** in code — dev must remember `.env` / `eas.json` for production behavior. |
| **Low** | Workout screen comment still says “state stays on-device”. |
| **Low** | No meal `PATCH`; macros on create only if sent. |
| **Ops** | Render free tier sleep; migration run is manual against Neon. |

---

## 9. Scalability & architectural concerns

1. **JSONB session blob** — Fine for MVP and personal scale; poor for SQL aggregates (e.g. “bench press volume last 90 days”) without parsing JSON in queries or ETL.
2. **Single active session** — Good UX guard; auto-close on new start is correct.
3. **No pagination** on `GET /meals` — Will degrade as history grows.
4. **No idempotency / conflict handling** on debounced mobile patches — rare duplicate or lost update possible on flaky network.
5. **No refresh token** — Long gym sessions won’t hit this; 7-day expiry is acceptable for personal use.
6. **Monorepo docs drift** — Increases onboarding cost.

---

## 10. Recommended next steps (priority order)

| P | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Fix Diet daily UX** — use `getDailySummary()` for ring/goal; filter meal list to today (or add date selector) | **S** (0.5–1 d) | Correct daily intake tracking |
| 2 | **`GET /sessions` history** — paginated, filter by date range; `GET /sessions/:id` detail | **M** (2–3 d) | Unblocks history goal |
| 3 | **History screen** — list past sessions, tap for read-only detail | **M** (2–4 d) | Core user-facing requirement |
| 4 | **Session summary card** — duration, total sets, volume estimate on end + in history | **M** (2–3 d) | Session-wise stats |
| 5 | **Calories burned** — schema + manual entry or MET estimate per session; daily rollup on dashboard | **L** (4–6 d) | Fulfills burned/intake goal |
| 6 | **`PATCH /user/profile`** — `goal_kcal`, name; wire Diet/Home to server goal | **S** (1 d) | Personalization |
| 7 | **Progress tab or Home charts** — weekly volume, workout frequency, kcal trends | **L** (5–8 d) | Long-term analysis |
| 8 | **Update README + ARCHITECTURE** | **S** (0.5 d) | Team clarity |
| 9 | **API tests + seed script** | **M** (2–3 d) | Regression safety |
| 10 | **Consider normalized sets table** (migration) | **XL** (1–2 w) | Only if heavy analytics planned |

**Effort key:** S = small (≤1 day), M = medium (2–4 days), L = large (about 1 week), XL = multi-week.

---

## 11. Estimated effort to reach full stated goal

| Milestone | Scope | Calendar estimate (solo dev) |
|-----------|--------|------------------------------|
| **MVP+** (fix diet daily + history list/detail) | Items 1–3 | **~1–1.5 weeks** |
| **Core product** (+ session stats + burned calories + profile goals) | Items 1–6 | **~3–4 weeks** |
| **Full vision** (+ charts, trends, meal edit, tests, schema hardening) | Items 1–10 | **~6–10 weeks** |

**Overall completion today:** ~**48%** of the full vision; ~**70%** of a tight “log today’s gym session and meals to the cloud” slice.

---

## 12. What “done” looks like for your original goal

Checklist for **100%** against the brief:

- [x] Log exercises/sets during a gym session (cloud)
- [x] Sign in; data scoped to user
- [x] Log calorie **intake** (cloud)
- [ ] Accurate **per-day** intake on Diet UI
- [ ] Log or derive calorie **burned**
- [ ] Open **any past day’s** workout
- [ ] Session stats (duration, volume, etc.)
- [ ] Long-term progress views (not just “days since last workout”)
- [ ] Consistent docs and env for production vs local dev

---

*This report reflects the repository as inspected on 2026-05-20. Re-run or extend after major features ship.*
