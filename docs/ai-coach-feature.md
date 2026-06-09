# SetFuel AI Coach — Feature Specification

| | |
|---|---|
| **Status** | Planned (not implemented) |
| **Last updated** | 2026-05-30 |
| **Owner** | Product / engineering |
| **Related docs** | [ai-coach-architecture.md](./ai-coach-architecture.md), [ai-food-agent.txt](./ai-food-agent.txt), [ARCHITECTURE.md](../ARCHITECTURE.md), [STATUS_REPORT.md](../STATUS_REPORT.md) |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem and goals](#2-problem-and-goals)
3. [Relationship to other AI features](#3-relationship-to-other-ai-features)
4. [Product vision](#4-product-vision)
5. [User experience](#5-user-experience)
6. [System architecture](#6-system-architecture)
7. [Coach context (data contract)](#7-coach-context-data-contract)
8. [API specification](#8-api-specification)
9. [Backend implementation](#9-backend-implementation)
10. [Mobile implementation](#10-mobile-implementation)
11. [Database schema (optional phases)](#11-database-schema-optional-phases)
12. [LLM integration](#12-llm-integration)
13. [Prompt engineering](#13-prompt-engineering)
14. [Safety, privacy, and compliance](#14-safety-privacy-and-compliance)
15. [Cost, rate limits, and reliability](#15-cost-rate-limits-and-reliability)
16. [Phased rollout plan](#16-phased-rollout-plan)
17. [Phase 2b — Workout intelligence](#17-phase-2b--workout-intelligence)
18. [Testing strategy](#18-testing-strategy)
19. [Observability and operations](#19-observability-and-operations)
20. [Future enhancements](#20-future-enhancements)
21. [Open decisions](#21-open-decisions)
22. [Appendix: codebase references](#22-appendix-codebase-references)

---

## 1. Executive summary

**SetFuel AI Coach** is a server-orchestrated conversational assistant that answers questions and offers suggestions based on **the authenticated user’s real workout and diet data** stored in PostgreSQL—not generic fitness advice disconnected from what they logged.

The coach:

- Reads **today’s meals**, **macros**, **calorie goal**, **workout sessions**, and **recent history** (calendar aggregates, last session stats).
- Respects the user’s **local timezone** (same semantics as Diet, History, and dashboard APIs).
- Returns **grounded** responses: numbers and exercise names must come from provided context; when data is missing, the coach says so and nudges logging instead of inventing entries.
- Runs **entirely on the backend** so API keys stay secret, context is consistent with the dashboard, and rate limits protect cost.

**Recommended delivery order:** Daily Brief (Home card) → Chat tab → **Workout intelligence (Phase 2b)** → Contextual history + persistence → Proactive notifications.

Phase 2b is the milestone that unlocks split-aware coaching—missed body parts, repeated sessions, and “what should I train next?” See [§17](#17-phase-2b--workout-intelligence).

This document is the implementation blueprint. Code does not exist yet; all paths and types below are **proposed** unless marked as *existing*.

---

## 2. Problem and goals

### 2.1 Problem

Users log workouts and meals in SetFuel but must **interpret** the data themselves:

- “Am I on track for calories today?”
- “Did I train enough volume this week?”
- “What should I eat given I trained legs this morning?”

The app already surfaces **dashboard summary** and **history day detail**, but not **natural-language guidance** tied to personal logs.

### 2.2 Goals

| ID | Goal | Success metric |
|----|------|----------------|
| G1 | Personalized insights from **logged** data | Coach cites real kcal/macros/session stats in replies |
| G2 | Fast, trustworthy answers | p95 latency &lt; 8s (non-streaming MVP); no fabricated meals/sets |
| G3 | Fits existing architecture | New `coach` routes + `coachService`; reuses `requireUser`, timezone, pool |
| G4 | Safe coaching boundaries | Clear non-medical disclaimer; no extreme diet praise |
| G5 | Controlled cost | Rate limits + optional daily-brief cache |

### 2.3 Non-goals (v1)

- Replacing a registered dietitian, doctor, or physical therapist.
- Generating workout programs from scratch without user programs as input (v2+ may suggest tweaks).
- Image / vision analysis (see [ai-food-agent.txt](./ai-food-agent.txt)).
- Calories **burned** estimation (not in schema yet per [STATUS_REPORT.md](../STATUS_REPORT.md)).
- Training on user data for a custom model (use commercial LLM APIs with zero-retention where possible).

---

## 3. Relationship to other AI features

SetFuel may host **two distinct AI systems**:

| Dimension | AI Food Agent (vision) | AI Coach (this doc) |
|-----------|------------------------|---------------------|
| **Input** | Meal photo | Text (+ optional date) |
| **Output** | Structured meal candidates → user confirms → DB | Natural language insights |
| **Models** | Vision LLM (e.g. GPT-4o, Llama Vision) | Text LLM (e.g. GPT-4o-mini, Claude Haiku/Sonnet) |
| **Writes DB** | Yes (`meal` rows after confirmation) | No (read-only on user data in v1) |
| **Doc** | [ai-food-agent.txt](./ai-food-agent.txt) | This file |

**Future convergence:** After a vision meal is confirmed, the coach can answer “How does this meal fit my day?” by including that meal in `CoachContext`—no merge of the two pipelines required at launch.

```mermaid
flowchart TB
  subgraph vision [Food Vision Agent - separate]
    Photo[Camera photo] --> VisionAPI[Vision LLM]
    VisionAPI --> Suggest[Meal suggestions]
    Suggest --> UserConfirm[User confirms]
    UserConfirm --> MealTable[(meal table)]
  end

  subgraph coach [AI Coach - this feature]
  UserChat[User message] --> CoachAPI[POST /coach/chat]
  CoachAPI --> Ctx[Context builder]
  Ctx --> MealTable
  Ctx --> SessionTable[(workout_session)]
  Ctx --> TextLLM[Text LLM]
  TextLLM --> Reply[Coach reply]
  end
```

---

## 4. Product vision

### 4.1 Positioning

**“Your gym and kitchen data, explained.”**

The coach is not a general chatbot. It is a **read-only analyst** over SetFuel logs with a **supportive coach tone**: short, actionable, specific.

### 4.2 Example interactions

| User message | Expected behavior |
|--------------|-------------------|
| “How am I doing today?” | Summarize today kcal vs `goal_kcal`, macros, workouts completed, 1–2 suggestions |
| “Am I eating enough protein?” | Compare today protein to a simple target (e.g. 0.8g/lb placeholder until profile goals exist) **only if** macro data exists on meals |
| “What did I do in my last workout?” | Use last ended session: exercises, sets completed, volume, duration |
| “Compare this week to last week” | Use calendar aggregates (workout days, meal days); admit limits if &lt; 7 days of data |
| “Should I train today?” | Use `lastWorkoutDaysAgo` + recent calendar; no medical clearance advice |
| “What body part did I miss this week?” | **Phase 2b** — `analyze_training_split` vs `workout_program` |
| “Which sessions did I repeat too much?” | **Phase 2b** — repetition counts by body part / program title |
| “What should I train next?” | **Phase 2b** — `suggestedNext` from split analysis + last session recency |

### 4.3 Personas (tone)

Pick one default in [§21 Open decisions](#21-open-decisions):

- **Analyst** — neutral, bullet facts, minimal encouragement.
- **Gym buddy** (recommended default) — concise, motivating, still data-grounded.

---

## 5. User experience

### 5.1 Surface options

| Option | Description | Phase |
|--------|-------------|-------|
| **A. Daily Brief card** | Home screen card: 3–5 auto-generated bullets once per local day | Phase 1 |
| **B. Coach tab** | Fifth tab or stack screen: chat UI + suggested prompts | Phase 2 |
| **C. Contextual entry** | “Ask coach about this day” from `HistoryDayDetailScreen` with `date` prefilled | Phase 3 |

**Recommendation:** Ship **A** first to validate context quality and prompts; then **B**.

### 5.2 Daily Brief (Phase 1)

**Placement:** `HomeScreen`, below existing dashboard cards (same `dashboard` theme as Home / Workout / Diet).

**Behavior:**

- On mount (and pull-to-refresh), call `GET /v1/coach/daily-brief`.
- Show loading skeleton → bullets or error with retry.
- “See full chat” CTA navigates to Coach screen (Phase 2).
- Cache on server per `(user_id, local_date)` to avoid repeated LLM calls.

**Empty / sparse data copy:**

- No meals today → “Log your first meal on the Diet tab for personalized nutrition tips.”
- No workouts this week → Encourage starting a session from Workout tab.

### 5.3 Coach chat (Phase 2)

**Layout:**

- Header: “Coach” + subtitle “Based on your SetFuel logs”
- Message list (user right, coach left; match app glass/dark theme)
- Suggested prompt chips above input (horizontal scroll)
- Text input + send; disable while request in flight
- Footer disclaimer (collapsible): not medical advice

**Suggested prompts (initial set):**

1. Summarize my day
2. How’s my nutrition vs my goal?
3. Review my last workout
4. What should I focus on tomorrow?
5. How active was I this week?

**Suggested prompts (Phase 2b — workout intelligence):**

1. What did I miss this week?
2. Which body parts did I train most?
3. What should I do in the gym today?
4. Did I repeat any session too often this month?
5. Review my split for the last 30 days

**Conversation:**

- v1: Client sends last **N** turns (e.g. 10) in request body; server does not require `conversationId`.
- v2: Server persists threads; client loads history on open.

### 5.4 Navigation integration

*Existing tabs:* Home · Workout · Diet · History (`MainTabNavigator.tsx`).

**Option 1 — Fifth tab “Coach”**  
Pros: discoverable. Cons: crowded tab bar.

**Option 2 — Stack screen from Home**  
`RootStack` → `CoachScreen`; Home brief card + header icon open chat.  
Pros: no tab bar change. Cons: slightly hidden.

**Option 3 — FAB on Home**  
Floating action opens coach modal.

Document decision in §21 before implementation.

### 5.5 Error and offline UX

| State | UX |
|-------|-----|
| Network error | Inline banner + retry on brief/chat |
| 429 rate limit | “You’ve reached today’s coach limit. Try again tomorrow.” |
| 503 LLM down | “Coach is temporarily unavailable. Your logs are safe—check back soon.” |
| `USE_LOCAL=true` | Hide coach or show static message: “Coach requires API mode.” |

Coach should **not** be offered in local-only dev mode unless a mock coach is implemented for UI work.

---

## 6. System architecture

### 6.1 High-level diagram

```mermaid
sequenceDiagram
  participant App as Mobile App
  participant API as Express /v1/coach
  participant Ctx as coachContext.ts
  participant DB as PostgreSQL
  participant LLM as LLM Provider

  App->>API: POST /coach/chat + JWT + timeZone
  API->>Ctx: buildContext(userId, date, tz)
  Ctx->>DB: meals, sessions, calendar aggregates
  DB-->>Ctx: rows
  Ctx-->>API: CoachContext JSON
  API->>LLM: system + context + messages
  LLM-->>API: assistant text
  API-->>App: { reply, citations? }
```

### 6.2 Design principles

1. **Server-side context only** — Mobile never assembles full history for the model.
2. **Small context window** — Target &lt; 3 KB JSON (~800–1200 tokens) before conversation history.
3. **Same timezone rules** — Reuse `getClientTimeZone`, `getLocalDateExpr`, `appendClientTimeZone` patterns.
4. **Read-only on fitness data** — Coach routes do not INSERT/UPDATE meals or sessions in v1.
5. **Separation of concerns** — `coachContext.ts` (SQL), `coachLlm.ts` (provider), `coach.ts` (HTTP).

### 6.3 Component map

```text
backend/src/
  routes/v1/coach.ts          # HTTP handlers
  lib/coachContext.ts         # SQL → CoachContext
  lib/coachLlm.ts             # Provider adapter
  lib/coachPrompts.ts         # System prompts (optional split)
  middleware/coachRateLimit.ts  # optional per-user limits

mobile/src/
  screens/coach/CoachScreen.tsx
  screens/coach/components/     # MessageBubble, PromptChips, BriefCard
  services/coachService.ts
  types/coach.ts
```

---

## 7. Coach context (data contract)

The context object is the **single source of truth** passed to the LLM (as JSON or compressed markdown). All coach answers must be traceable to fields here.

### 7.1 TypeScript shape (proposed)

```typescript
/** Compact stats — mirrors backend computeSessionStats */
type CoachSessionSummary = {
  id: string;
  startedAt: string;       // ISO
  endedAt: string;           // ISO
  durationMinutes: number | null;
  exerciseCount: number;
  setsCompleted: number;
  setCount: number;
  volumeKg: number;
  /** Top 5 exercise names by set count */
  exercises: string[];
};

type CoachMealSummary = {
  id: string;
  name: string;
  kcal: number;
  time: string;
  macros?: { protein: number; carbs: number; fats: number };
};

type CoachDayDiet = {
  totalKcal: number;
  goalKcal: number;
  nutritionProgress: number; // 0–1
  mealsLogged: number;
  macros: { protein: number; carbs: number; fats: number };
  meals: CoachMealSummary[];
};

type CoachContext = {
  generatedAt: string;       // ISO UTC
  focusDate: string;         // YYYY-MM-DD in user TZ
  timeZone: string;

  user: {
    displayName: string;
    goalKcal: number;
    // future: goalProteinG, trainingGoal: 'cut' | 'bulk' | 'maintain'
  };

  today: {
    diet: CoachDayDiet;
    workouts: CoachSessionSummary[];
    hasActiveSession: boolean; // from GET /sessions/active if needed
  };

  recent: {
    /** Last 7 local days inclusive */
    workoutDays: number;
    mealLoggingDays: number;
    lastWorkout: {
      daysAgo: number;
      volumeKg: number;
      durationMinutes: number | null;
      topExercises: string[];
    } | null;
    /** Optional: avg kcal on days with meals */
    avgDailyKcalLast7: number | null;
  };

  dataQuality: {
    mealsLoggedToday: number;
    workoutsLoggedToday: number;
    hasMacroDataOnMealsToday: boolean;
    warnings: string[];  // e.g. "No meals logged today"
  };
};
```

### 7.2 Context builder logic

**File:** `backend/src/lib/coachContext.ts`  
**Function:** `buildCoachContext(pool, userId, req, focusDate?: string): Promise<CoachContext>`

| Field | Source (*existing* code to reuse) |
|-------|-----------------------------------|
| `user.displayName`, `goalKcal` | `app_user` — same as `user.ts` profile/dashboard |
| `today.diet` | Same queries as `GET /history/day` for `focusDate` (default: today in client TZ) |
| `today.workouts` | Sessions on that day from `history/day` query + `computeSessionStats()` |
| `recent.workoutDays` / `mealLoggingDays` | Aggregate from `history/calendar` for `[today-6, today]` |
| `recent.lastWorkout` | Latest `workout_session` with `ended_at` + stats |
| `recent.avgDailyKcalLast7` | Group meals by day over 7 days (new SQL, similar to calendar) |
| `dataQuality.warnings` | Rules engine (see below) |

**Data quality rules (examples):**

```typescript
if (mealsLoggedToday === 0) warnings.push('No meals logged for focus date.');
if (!hasMacroDataOnMealsToday && mealsLoggedToday > 0)
  warnings.push('Meals lack macro breakdown; protein advice may be limited.');
if (workoutDays === 0 && focusDate is today)
  warnings.push('No completed workouts in the last 7 days.');
```

### 7.3 Context size budget

| Section | Max items |
|---------|-----------|
| `today.diet.meals` | 20 (truncate with `mealsLogged` count) |
| `today.workouts` | 5 sessions |
| `exercises` per session | 5 names |
| Conversation history (chat only) | 10 turns × ~500 chars |

If over budget, truncate oldest meals first; keep totals/macros complete.

### 7.4 Markdown alternative for LLM

Some teams send context as markdown instead of raw JSON:

```markdown
## User
- Name: Alex
- Calorie goal: 2500 kcal

## Today (2026-05-29, America/Los_Angeles)
### Diet
- 1420 / 2500 kcal (57%)
- Protein 98g | Carbs 120g | Fat 45g
- Meals: Greek Yogurt Bowl (420), ...
### Workouts
- Push Day: 52 min, 12 sets, volume 4200 kg, exercises: Bench, OHP, ...
```

Either JSON or markdown is fine; **pick one** and stay consistent in prompts.

---

## 8. API specification

All routes live under `/v1/coach`, protected by `requireUser` (same as meals/sessions). Register in `backend/src/routes/v1/index.ts`.

### 8.1 `GET /v1/coach/daily-brief`

**Purpose:** One-shot insights for Home card (Phase 1).

**Query params:**

| Param | Required | Description |
|-------|----------|-------------|
| `timeZone` | Recommended | IANA TZ — same as history/meals |
| `tzOffsetMinutes` | Recommended | Fallback |
| `date` | No | `YYYY-MM-DD`; default today in client TZ |

**Response `200`:**

```json
{
  "date": "2026-05-29",
  "brief": [
    "You're at 1,420 of 2,500 kcal (57%) with dinner still to log.",
    "Protein is 98g so far — aim for 30–40g at your next meal if you're targeting ~150g/day.",
    "Last workout was 2 days ago (Push, 52 min, 4,200 kg volume).",
    "This week: 3 workout days and 5 days with meals logged."
  ],
  "generatedAt": "2026-05-29T18:00:00.000Z",
  "cached": true
}
```

**Caching:** Store brief text + `generatedAt` keyed by `(user_id, date)`. Invalidate when user adds meal or ends workout on that day (Phase 2 optimization); MVP can use TTL 4–6 hours.

**Errors:** `400` invalid date, `429` rate limit, `503` LLM failure.

---

### 8.2 `POST /v1/coach/chat`

**Purpose:** Multi-turn conversation (Phase 2).

**Request body:**

```json
{
  "message": "How did my last workout compare to this week?",
  "date": "2026-05-29",
  "history": [
    { "role": "user", "content": "Summarize my day" },
    { "role": "assistant", "content": "..." }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string | Yes | 1–2000 chars |
| `date` | string | No | Focus date for context |
| `history` | array | No | Max 10 turns; roles `user` \| `assistant` only |

**Response `200`:**

```json
{
  "reply": "Your last workout was 2 days ago...",
  "focusDate": "2026-05-29",
  "citations": [
    { "type": "session", "id": "sess_abc", "label": "Push Day" },
    { "type": "meal", "id": "meal_xyz", "label": "Greek Yogurt Bowl" }
  ],
  "usage": {
    "promptTokens": 1200,
    "completionTokens": 180
  }
}
```

`citations` optional in MVP; enables future deep links to History day / meal row.

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "message": "message is required" }` |
| `429` | `{ "message": "Daily coach message limit reached" }` |
| `503` | `{ "message": "Coach temporarily unavailable" }` |

---

### 8.3 `GET /v1/coach/conversations` (Phase 2b — optional)

List persisted threads when DB tables exist.

---

### 8.4 Version discovery

Add to `GET /v1` route list in `index.ts`:

```text
GET  /coach/daily-brief
POST /coach/chat
```

---

## 9. Backend implementation

### 9.1 New dependencies

Add to `backend/package.json` (exact package TBD in §20):

- `openai` **or** `@anthropic-ai/sdk`
- Optional: `zod` for request validation (if not already used)

**Environment variables** (`backend/.env.example`):

```bash
# AI Coach (text LLM)
COACH_LLM_PROVIDER=openai          # openai | anthropic
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini           # daily brief + chat default
ANTHROPIC_API_KEY=                 # if provider=anthropic
ANTHROPIC_MODEL=claude-3-5-haiku-latest

COACH_DAILY_MESSAGE_LIMIT=30       # per user per local day
COACH_BRIEF_CACHE_TTL_HOURS=6
COACH_REQUEST_TIMEOUT_MS=25000
```

### 9.2 `coachContext.ts`

Pseudocode:

```typescript
export async function buildCoachContext(
  userId: string,
  req: Request,
  focusDate?: string,
): Promise<CoachContext> {
  const timeZone = getClientTimeZone(req);
  const date = focusDate ?? todayInTimeZone(timeZone);
  // Parallel queries: profile, day detail, calendar 7d, last session
  // Map to CoachContext + dataQuality.warnings
}
```

**Reuse:**

- `getLocalDateExpr` from `backend/src/lib/clientTimeZone.ts`
- `computeSessionStats`, `parseExercises` from `backend/src/lib/workoutStats.ts`
- SQL patterns from `backend/src/routes/v1/history.ts` and `user.ts`

### 9.3 `coachLlm.ts`

Responsibilities:

- `generateDailyBrief(context: CoachContext): Promise<string[]>`
- `generateChatReply(context: CoachContext, message: string, history: Message[]): Promise<{ reply: string; citations?: Citation[] }>`
- Timeout via `AbortSignal`
- Map provider errors to `503`
- **Never** log full API keys; log `userId`, token counts, latency

### 9.4 `coach.ts` router

```typescript
coachRouter.get('/daily-brief', ...);
coachRouter.post('/chat', ...);
```

Apply rate limit middleware before handler.

### 9.5 Rate limiting

| Limit | Value (suggested) |
|-------|-------------------|
| Chat messages per user per local day | 30 |
| Daily brief generations per user per day | 5 (rest served from cache) |
| Max `message` length | 2000 chars |
| Max `history` turns | 10 |

Implementation options:

- In-memory `Map` (dev only)
- Postgres table `coach_rate_limit` (user_id, date, count)
- Redis (if introduced later)

### 9.6 Caching daily brief

**Table (optional):** `coach_daily_brief_cache`

| Column | Type |
|--------|------|
| user_id | BIGINT FK |
| local_date | DATE |
| bullets | JSONB |
| context_hash | TEXT | optional: invalidate when meals/sessions change |
| created_at | TIMESTAMPTZ |

---

## 10. Mobile implementation

### 10.1 Types — `mobile/src/types/coach.ts`

```typescript
export type CoachBrief = {
  date: string;
  brief: string[];
  generatedAt: string;
  cached?: boolean;
};

export type CoachMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type CoachChatResponse = {
  reply: string;
  focusDate: string;
  citations?: { type: 'session' | 'meal'; id: string; label: string }[];
};
```

Export from `mobile/src/types/index.ts`.

### 10.2 Service — `mobile/src/services/coachService.ts`

```typescript
import { appendClientTimeZone } from '../lib/clientTimeZone';
import { apiFetch, USE_LOCAL } from './api';

export async function getDailyBrief(date?: string): Promise<CoachBrief> {
  if (USE_LOCAL) throw new Error('Coach requires API mode');
  const q = appendClientTimeZone(new URLSearchParams());
  if (date) q.set('date', date);
  return apiFetch<CoachBrief>(`/coach/daily-brief?${q}`);
}

export async function sendCoachMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  date?: string,
): Promise<CoachChatResponse> {
  if (USE_LOCAL) throw new Error('Coach requires API mode');
  return apiFetch<CoachChatResponse>('/coach/chat', {
    method: 'POST',
    body: { message, history, date },
  });
}
```

Append `timeZone` on POST via header or body—**match** how other routes receive TZ (query on GET; for POST, include in body or use shared header helper if added).

### 10.3 Screens

| File | Responsibility |
|------|----------------|
| `CoachScreen.tsx` | Chat UI, message state, send handler |
| `DailyBriefCard.tsx` | Home embed; loading/error/bullets |
| `CoachPromptChips.tsx` | Suggested prompts |

**State:** Local `useState` for messages in v1; consider `useReducer` if streaming added.

### 10.4 Home integration

In `HomeScreen.tsx`:

- Fetch `getDailyBrief()` alongside `getDashboardSummary()` in parallel (`Promise.allSettled`).
- Do not block dashboard if brief fails.
- Pull-to-refresh includes brief refetch.

### 10.5 Styling

Use existing `dashboard` theme tokens (`mobile/src/theme`) for consistency with Home, Workout, Diet, History.

### 10.6 Feature flag

Optional `EXPO_PUBLIC_COACH_ENABLED=true` in `mobile/.env.example` to hide UI until backend is deployed.

---

## 11. Database schema (optional phases)

### 11.1 Phase 1 — No new tables

Daily brief cache can live in memory or a simple table; chat is stateless.

### 11.2 Phase 2 — Conversation persistence

**Migration:** `backend/sql/004_coach.sql`

```sql
CREATE TABLE IF NOT EXISTS coach_conversation (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coach_message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coach_conversation (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_message_conversation
  ON coach_message (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS coach_daily_brief_cache (
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  bullets JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);
```

### 11.3 Phase 3 — Audit log (optional)

`coach_request_log` for debugging (no PII in message text if policy requires minimization).

---

## 12. LLM integration

### 12.1 Provider selection

| Provider | Pros | Cons |
|----------|------|------|
| **OpenAI** `gpt-4o-mini` | Cheap, fast, good JSON discipline | Vendor lock-in |
| **Anthropic** Haiku | Strong safety refusals | Slightly different API |
| **Local Ollama** | Dev offline | Not for production mobile |

**Recommendation:** `gpt-4o-mini` for brief + chat MVP; upgrade to `gpt-4o` or Sonnet for complex weekly analysis if quality insufficient.

### 12.2 Request structure

```typescript
{
  model: config.openaiModel,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `USER_DATA:\n${contextJson}\n\nUSER_MESSAGE:\n${message}` },
    // ... prior turns
  ],
  temperature: 0.4,
  max_tokens: 600,
}
```

Low temperature reduces creative hallucination.

### 12.3 Structured output (optional)

Ask for JSON `{ "bullets": string[], "citations": [...] }` with `response_format: { type: 'json_object' }` for daily brief parsing reliability.

### 12.4 Streaming (Phase 2b)

`POST /coach/chat/stream` as SSE:

- Mobile: `fetch` + `ReadableStream` or EventSource polyfill
- Improves perceived latency
- Not required for MVP

---

## 13. Prompt engineering

### 13.1 System prompt (template)

```text
You are SetFuel Coach, a fitness and nutrition assistant inside the SetFuel app.

RULES:
1. Use ONLY facts from the USER_DATA block. Never invent meals, exercises, sets, or calories.
2. If USER_DATA warnings indicate missing logs, say so and suggest logging in the app (Diet or Workout tab).
3. Keep replies concise: prefer 3–6 bullets or 2–4 short paragraphs unless the user asks for detail.
4. Give actionable suggestions (what to eat next, recovery, consistency) grounded in their numbers.
5. You are NOT a doctor, dietitian, or physical therapist. Do not diagnose injuries or eating disorders.
6. Do not encourage extreme calorie restriction, purging, or dangerous training volumes.
7. Use the user's display name sparingly. Units: kcal, kg, minutes as in USER_DATA.

When comparing to goals, use goalKcal from USER_DATA. For protein targets without a user goal, you may mention general ranges but label them as general guidance, not prescription.
```

### 13.2 Daily brief user prompt

```text
Generate exactly 4 bullet insights for the user's dashboard card.
Each bullet max 120 characters.
Prioritize: calorie progress, macros (if available), last workout recency, weekly consistency.
If data is sparse, one bullet must encourage logging.
Return JSON: { "bullets": string[] }
```

### 13.3 Evaluation checklist (manual QA)

- [ ] Coach never cites a meal not in `today.diet.meals`
- [ ] Coach admits “no workouts logged” when `workouts` empty
- [ ] Changing timezone changes “today” consistently with Diet screen
- [ ] Asking about medical condition → redirects to professional
- [ ] Empty new user → encouraging onboarding, not fake stats

---

## 14. Safety, privacy, and compliance

### 14.1 Safety

| Risk | Mitigation |
|------|------------|
| Hallucinated logs | Grounding rules + low temperature + context-only policy |
| Medical advice | System prompt + UI disclaimer |
| Eating disorder triggers | Refuse weight-loss encouragement for underweight scenarios; avoid “skip meals” |
| Injury diagnosis | “Consult a professional if pain persists” |

### 14.2 Privacy

- LLM API calls include **minimum** PII: `displayName` optional; never send email to model.
- Prefer providers with **zero training** on API data (check vendor DPA).
- Do not send meal `image_uri` to text coach in v1.
- Log retention: 30 days for request metadata; message content logging policy TBD.

### 14.3 Auth

All coach endpoints require valid JWT (`requireUser` middleware)—same as `/v1/meals`.

---

## 15. Cost, rate limits, and reliability

### 15.1 Cost estimate (rough)

Assume ~1.5k input + 400 output tokens per chat turn, `gpt-4o-mini`:

- ~$0.0003–0.001 per message (verify current pricing)
- 30 messages/user/day × 1000 users → monitor monthly cap

**Daily brief** with cache: ≤5 LLM calls/user/day.

### 15.2 Reliability

| Failure | Behavior |
|---------|----------|
| LLM timeout (25s) | 503 + retry message |
| Invalid JSON from model | Retry once; fallback generic brief |
| DB down | 500; coach unavailable |

### 15.3 Circuit breaker (optional)

After N consecutive LLM failures, return cached brief or static fallback for 15 minutes.

---

## 16. Phased rollout plan

### Phase 1 — Daily Brief (MVP)

**Backend**

- [ ] `coachContext.ts`
- [ ] `coachLlm.ts` + env vars
- [ ] `GET /coach/daily-brief`
- [ ] In-memory or DB brief cache
- [ ] Rate limit brief generations

**Mobile**

- [ ] `coachService.getDailyBrief`
- [ ] `DailyBriefCard` on Home
- [ ] Hide when `USE_LOCAL`

**Exit criteria:** Brief matches dashboard kcal; 10 manual QA scenarios pass.

---

### Phase 2 — Chat

**Backend**

- [ ] `POST /coach/chat`
- [ ] Daily message rate limit
- [ ] Optional citations in response

**Mobile**

- [ ] `CoachScreen` + navigation
- [ ] Prompt chips
- [ ] Message list + loading states

**Exit criteria:** 20-question QA script; no hallucinated meals in stress test.

**Does not include:** body-part gap analysis, month-level split review, or grounded “train X next” suggestions — see [§17 Phase 2b](#17-phase-2b--workout-intelligence).

---

### Phase 2b — Workout intelligence (summary)

**Depends on:** Phase 2 chat + agentic tool loop (see [ai-coach-architecture.md](./ai-coach-architecture.md)).

**Delivers:** Split-aware workout coaching — missed body parts, repeated sessions, exercise-level history, and “what to train next” grounded in the user’s programs and logged sessions.

**Backend (checklist)**

- [ ] `get_programs` tool
- [ ] `get_session_history` tool
- [ ] `analyze_training_split` tool (server-side logic, not LLM math)
- [ ] `resolveBodyPart` / exercise → muscle mapping module
- [ ] Optional migration: `workout_session.program_id`
- [ ] Extend daily brief with optional workout bullet when 2b ships

**Mobile**

- [ ] Workout intelligence prompt chips on `CoachScreen`
- [ ] Optional: “Train next: Back” chip on Home brief (from `suggestedNext`)

**Exit criteria:** See [§17.10](#1710-exit-criteria).

**Full specification:** [§17](#17-phase-2b--workout-intelligence).

---

### Phase 3 — Contextual + persistence

- [ ] “Ask about this day” from History
- [ ] DB tables for conversations
- [ ] Brief cache invalidation on new meal/session
- [ ] Streaming responses

---

### Phase 4 — Advanced coach

- [ ] Profile goals: protein target, cut/bulk (`PATCH /user/profile`)
- [ ] Calories burned in context (when feature ships)
- [ ] Push notification: “You're 800 kcal under goal”
- [ ] Progressive overload / PR detection across sessions
- [ ] Voice input to coach

---

## 17. Phase 2b — Workout intelligence

This section specifies **split-aware workout coaching**: answering questions about missed body parts, repeated sessions, monthly patterns, and what to train next—grounded in the user’s **workout programs** and **completed session history**.

**Prerequisites**

| Prerequisite | Status |
|--------------|--------|
| Phase 2 chat (`POST /v1/coach/chat`) with agentic tool loop | Required |
| `workout_program` rows synced for user (API mode) | Required |
| Completed `workout_session` rows with `exercises` JSONB | Required |
| Phase 1 daily brief | Optional enhancer (workout bullet from 2b analysis) |

**Not in scope for Phase 2b**

- Generating full custom programs from scratch (only suggests **next body part / program** from user’s existing list)
- Injury diagnosis or rehab protocols
- Calories burned or recovery scoring
- Replacing the Workout tab UI (coach advises; user still starts sessions manually)

---

### 17.1 Problem statement

Phase 1 and Phase 2 answer **“what happened?”** (kcal, last session, workout day counts). Users also want **“what should I do?”** at the split level:

| User question | Requires |
|---------------|----------|
| “What body part did I **miss** this week / month?” | Expected split (`workout_program`) vs actual sessions |
| “Which session did I **repeat** a lot?” | Count sessions per body part / program over a range |
| “What **exercises** should I do next?” | Program `blocks` for suggested body part + recent exercise names |
| “Based on **today**, what fits my plan?” | Day-of-week labels (`day_label`) + recency + missed parts |

Phase 1 loads only **7-day workout day count** and **last session top exercises**. Phase 2 can fetch individual days but has **no body-part model** and **no programs in context**. Phase 2b closes that gap.

---

### 17.2 Current data gaps

| Gap | Impact | Phase 2b fix |
|-----|--------|--------------|
| `workout_session` has no `program_id` | Cannot reliably know if a session was “Chest Monday” vs ad-hoc | Optional `program_id` on session start; fallback inference |
| Body part not stored on session | Must infer from program title or exercise names | `resolveBodyPart()` module |
| Programs not in coach tools | Coach cannot know user’s intended split | `get_programs` tool |
| No month-level session rollup | “This month” needs up to 30 sessions | `get_session_history` + `analyze_training_split` |
| LLM guessing muscle groups | Hallucinated “you missed legs” | Server-side `analyze_training_split` output is source of truth |

**Existing schema** (`backend/sql/002_api_core.sql`):

```sql
-- workout_program: id, title, day_label, blocks (JSONB)
-- workout_session: id, started_at, ended_at, exercises (JSONB) — no program_id today
```

**Program titles in the wild** (from `personalRoutines.ts`): `Chest`, `Chest 2.0`, `Back`, `Shoulders`, `Legs`, etc.—`title` is the primary body-part signal when `program_id` is present.

---

### 17.3 Schema changes (recommended)

**Migration:** `backend/sql/006_coach_workout_intelligence.sql`

```sql
-- Link completed sessions to the program the user started (optional but strongly recommended)
ALTER TABLE workout_session
  ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES workout_program (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_session_user_program
  ON workout_session (user_id, program_id)
  WHERE program_id IS NOT NULL;

-- Optional denormalized cache for coach (can be computed on the fly instead)
-- ALTER TABLE workout_session ADD COLUMN IF NOT EXISTS body_part TEXT;
```

**Mobile / API change:** When user starts a workout from a program card, `POST /sessions` includes `programId`. Existing sessions remain `program_id = NULL` (inference fallback only).

**Backfill:** Not required for launch; coach uses inference for old sessions.

---

### 17.4 Body-part resolution

**Module:** `backend/src/coach/resolveBodyPart.ts`

Every completed session is classified into a **canonical body part** for analytics.

#### 17.4.1 Resolution priority

```text
1. session.program_id → workout_program.title → normalize(title)
2. Else: majority vote from exercise names → muscle group via keyword map
3. Else: "unknown" (excluded from missed/repeated counts; surfaced in dataQuality.warnings)
```

#### 17.4.2 Canonical body parts

```typescript
type BodyPart =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'full_body'
  | 'cardio'
  | 'unknown';
```

#### 17.4.3 Title normalization (examples)

| Program `title` | Canonical |
|-----------------|-----------|
| `Chest`, `Chest 2.0` | `chest` |
| `Back` | `back` |
| `Shoulders` | `shoulders` |
| `Legs`, `Leg day` | `legs` |
| `Arms`, `Biceps / Triceps` | `arms` |

Store rules in `backend/src/coach/bodyPartRules.ts` (title regex + keyword map). LLM does **not** define the mapping.

#### 17.4.4 Exercise keyword map (fallback)

When `program_id` is null, scan `exercises[].name` (lowercased):

| Keywords | Body part |
|----------|-----------|
| `bench`, `fly`, `push-up`, `chest press` | `chest` |
| `row`, `pulldown`, `pull-up`, `deadlift` | `back` |
| `ohp`, `overhead press`, `lateral raise`, `arnold` | `shoulders` |
| `squat`, `lunge`, `leg press`, `calf` | `legs` |
| `curl`, `tricep`, `pushdown` | `arms` |
| `plank`, `crunch`, `ab` | `core` |

If top two body parts tie within 10% of hits, use `unknown` and warn.

---

### 17.5 New coach tools

Register in `backend/src/coach/tools/` (see [ai-coach-architecture.md](./ai-coach-architecture.md)). All tools enforce `user_id` from JWT.

#### Tool 10: `get_programs`

| Field | Value |
|-------|-------|
| **Purpose** | User’s intended training split |
| **Input** | `{}` |
| **Output** | `{ programs: PersonalRoutine[] }` — same shape as `GET /v1/programs` |
| **SQL** | `SELECT id, title, day_label, blocks FROM workout_program WHERE user_id = $1 ORDER BY title` |

#### Tool 11: `get_session_history`

| Field | Value |
|-------|-------|
| **Purpose** | Completed sessions in a date range with stats and body-part classification |
| **Input** | `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD", limit?: number }` — `limit` max 60, default 30 |
| **Output** | See `SessionHistoryEntry` below |
| **SQL** | Sessions where `ended_at IS NOT NULL`, local-date filter via `getLocalDateExpr` |

```typescript
type SessionHistoryEntry = {
  id: string;
  date: string;                    // local YYYY-MM-DD
  startedAt: string;
  endedAt: string;
  programId: string | null;
  programTitle: string | null;   // join workout_program if program_id set
  bodyPart: BodyPart;
  bodyPartSource: 'program' | 'exercises' | 'unknown';
  stats: SessionStats;           // from computeSessionStats()
  exerciseNames: string[];       // all names, max 20
};
```

#### Tool 12: `analyze_training_split`

| Field | Value |
|-------|-------|
| **Purpose** | **Server-side** split analysis—the LLM explains results; it does not compute them |
| **Input** | `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` — max range 90 days |
| **Output** | `TrainingSplitAnalysis` (below) |
| **Implementation** | Calls `get_programs` + `get_session_history` internally; pure TypeScript aggregation |

```typescript
type TrainingSplitAnalysis = {
  range: { from: string; to: string };
  expectedBodyParts: BodyPart[];     // from program titles (unique canonical)
  sessionsAnalyzed: number;
  sessionsWithUnknownBodyPart: number;

  byBodyPart: {
    bodyPart: BodyPart;
    sessionCount: number;
    totalVolumeKg: number;
    lastTrainedDate: string | null;
    programTitles: string[];       // e.g. ["Chest", "Chest 2.0"]
  }[];

  missed: {
    bodyPart: BodyPart;
    expectedFromPrograms: boolean; // true if user has a program for this part
    daysSinceLastTrained: number | null;
  }[];

  repeated: {
    bodyPart: BodyPart;
    sessionCount: number;
    threshold: number;             // e.g. 3 in range
    message: string;               // deterministic, e.g. "Chest trained 4 times"
  }[];

  suggestedNext: {
    bodyPart: BodyPart;
    programId: string | null;
    programTitle: string | null;
    reason: string;                // deterministic code → human string
    dayLabelMatch: string | null;  // e.g. "Wednesday" if program matches today
  };

  dataQuality: {
    warnings: string[];
  };
};
```

---

### 17.6 `analyze_training_split` algorithm

**File:** `backend/src/coach/analyzeTrainingSplit.ts`

#### Step 1 — Load inputs

1. `programs = get_programs(userId)`
2. `sessions = get_session_history(userId, from, to)`
3. `expectedBodyParts` = unique canonical parts from each `program.title`

#### Step 2 — Aggregate by body part

For each session with `bodyPart !== 'unknown'`:

- Increment `sessionCount`
- Add `stats.volumeKg` to `totalVolumeKg`
- Track `lastTrainedDate` (max date)
- Collect distinct `programTitle` values

#### Step 3 — Missed body parts

For each `bodyPart` in `expectedBodyParts`:

- If `sessionCount === 0` in range → **missed**
- Else if `daysSinceLastTrained > 7` (configurable `COACH_MISSED_DAYS_THRESHOLD`) → **missed** (stale)

Parts in `expectedBodyParts` with zero matching programs are skipped.

#### Step 4 — Repeated sessions

Default threshold: **≥ 3 sessions** same `bodyPart` in range (env: `COACH_REPEAT_THRESHOLD=3`).

Flag as `repeated` if `sessionCount >= threshold`. Ties for “most repeated” sorted by `sessionCount` desc.

#### Step 5 — Suggested next session

Priority order (first match wins):

| Priority | Rule | `reason` code |
|----------|------|---------------|
| 1 | Body part in `missed` with highest `daysSinceLastTrained` (or never trained) | `missed_longest` |
| 2 | Program whose `day_label` matches **today’s weekday** (user TZ) and body part not trained today | `day_label_match` |
| 3 | Body part with lowest `sessionCount` in range among `expectedBodyParts` | `lowest_frequency` |
| 4 | If no programs: suggest body part from `lastWorkout` inverse (e.g. trained chest → suggest back) — **weak** | `recency_balance` |

Pick `programId` / `programTitle` from user’s programs where `normalize(title) === suggestedNext.bodyPart`. If multiple (e.g. Chest + Chest 2.0), prefer program not used in most recent session for that part.

#### Step 6 — Suggested exercises (for coach narrative)

When coach needs exercise names, attach from chosen program’s `blocks[].items` (first block, up to 8 items)—**not** invented by LLM.

```typescript
type SuggestedExercises = {
  programTitle: string;
  exercises: string[];  // from blocks
};
```

Return inside `suggestedNext` or as separate field `suggestedExercises`.

#### Step 7 — Data quality warnings

```typescript
if (programs.length === 0) warnings.push('No workout programs on file; add programs on the Workout tab.');
if (sessionsAnalyzed === 0) warnings.push('No completed workouts in range.');
if (sessionsWithUnknownBodyPart > 0)
  warnings.push(`${sessionsWithUnknownBodyPart} session(s) could not be classified by body part.`);
```

---

### 17.7 Example user flows

#### Flow A — “What did I miss this week?”

```text
User → POST /coach/chat { message: "What did I miss this week?" }

Orchestrator:
  1. LLM → tool: analyze_training_split({ from: monday, to: today })
  2. Tool returns { missed: [{ bodyPart: "back", daysSinceLastTrained: null }, ...] }
  3. LLM → "You hit Chest twice and Shoulders once. You didn't train Back this week.
            Your Back program is 'Back' (Wednesday)—want to prioritize that next?"
```

#### Flow B — “Which sessions did I repeat a lot this month?”

```text
  1. analyze_training_split({ from: firstOfMonth, to: today })
  2. repeated: [{ bodyPart: "chest", sessionCount: 4, threshold: 3 }]
  3. LLM explains with exact counts from tool output
```

#### Flow C — “What should I train today?”

```text
  1. analyze_training_split({ from: today-30d, to: today })
  2. suggestedNext: { bodyPart: "back", programTitle: "Back", reason: "day_label_match" }
  3. get_programs() if needed for block items
  4. LLM: "Today's Wednesday—your Back day. Last Back session was 9 days ago.
            Consider: Pull-ups, Seated cable row, Lat pulldown… (from your program)."
```

#### Flow D — Daily brief enhancement (optional)

After Phase 2b, `GET /v1/coach/daily-brief` may add one bullet:

```text
analyze_training_split({ from: today-7d, to: today }) → suggestedNext
Bullet: "Suggestion: Back day — you haven't trained back in 9 days."
```

---

### 17.8 LLM and prompt rules (Phase 2b)

Add to system prompt when workout tools are enabled:

```text
WORKOUT INTELLIGENCE RULES:
1. For missed parts, repeats, and "what's next", ALWAYS call analyze_training_split first.
2. Never invent body parts, session counts, or program names—use tool output only.
3. When suggesting exercises, list names from suggestedNext / program blocks only.
4. If dataQuality.warnings includes missing programs, tell user to add programs on Workout tab.
5. If bodyPart is unknown for many sessions, say classification is partial—do not guess.
6. "Missed" means missed relative to the user's own programs, not a generic bro-split.
```

**Tool selection hints** (orchestrator can inject on keyword match):

| User message contains | Prefer tool |
|-----------------------|-------------|
| `miss`, `skip`, `forgot` | `analyze_training_split` (7d or 30d) |
| `repeat`, `too much`, `often` | `analyze_training_split` (30d) |
| `next`, `today`, `should I train` | `analyze_training_split` (30d) |
| `month` | `from` = first day of current month |

---

### 17.9 API and mobile changes

**No new HTTP routes** — Phase 2b is delivered through existing `POST /v1/coach/chat` tool registrations.

**Optional:** extend daily brief context builder to call `analyzeTrainingSplit` for one bullet (see §17.7 Flow D).

**Mobile — `CoachScreen` prompt chips** (§5.3)

**Mobile — `POST /sessions` payload** (when starting from program card):

```typescript
// workoutService.startSession
{ programId?: string }  // new optional field
```

**Types — `mobile/src/types/coach.ts`:**

```typescript
export type TrainingSplitAnalysis = { /* mirror §17.5 */ };

export type CoachChatResponse = {
  reply: string;
  focusDate: string;
  workoutAnalysis?: TrainingSplitAnalysis;  // optional: attach for UI chips / debug
  citations?: { type: 'session' | 'program'; id: string; label: string }[];
};
```

Exposing `workoutAnalysis` on the response is optional; enables a future “View split summary” card in chat.

---

### 17.10 Exit criteria

| # | Scenario | Pass condition |
|---|----------|----------------|
| 1 | User with Chest + Back programs, only Chest logged 3× in 7d | Coach says Back missed; counts match DB |
| 2 | User asks “repeat too much” with 4 Chest sessions in 30d | `repeated` cites Chest ≥ threshold |
| 3 | “What should I train today?” on Wednesday with Back `day_label` | `suggestedNext.bodyPart === 'back'` |
| 4 | Session started with `programId` | Classified via `program`, not keyword guess |
| 5 | Session without `programId` but bench exercises | Classified `chest` via keywords |
| 6 | No programs | Warning + generic encouragement, no fake missed list |
| 7 | No sessions in range | Honest empty state, no invented workouts |
| 8 | LLM stress test | Zero body parts in reply not present in `analyze_training_split` output |

---

### 17.11 Implementation checklist

**Backend**

- [ ] `006_coach_workout_intelligence.sql` (optional `program_id`)
- [ ] `resolveBodyPart.ts` + `bodyPartRules.ts`
- [ ] `analyzeTrainingSplit.ts`
- [ ] Tools: `get_programs`, `get_session_history`, `analyze_training_split`
- [ ] Register tools in orchestrator tool registry
- [ ] Update `POST /sessions` to accept and persist `programId`
- [ ] Unit tests: normalization, aggregation, suggestedNext priority
- [ ] Integration test: mocked sessions → expected `missed` / `repeated`

**Mobile**

- [ ] Pass `programId` when starting workout from program card
- [ ] Phase 2b prompt chips on `CoachScreen`
- [ ] (Optional) brief bullet for `suggestedNext`

**Docs / ops**

- [ ] Update [ai-coach-architecture.md](./ai-coach-architecture.md) tool catalog (tools 10–12)
- [ ] `RELEASE_NOTES.md` entry when shipped

---

### 17.12 Limitations and honesty

| Limitation | Coach behavior |
|------------|----------------|
| Ad-hoc sessions without `program_id` | May classify as `unknown` or wrong part—disclose uncertainty |
| User has no programs | Cannot compute “missed”; prompt to add programs |
| `day_label` is free text (“Monday”, “Alternate day”) | Weekday match is best-effort; prefer `missed` over day_label when ambiguous |
| Two programs same body part (Chest + Chest 2.0) | Counts merge under `chest`; suggest one program by recency rule |
| Exercise rename typos | Keyword map may miss—prefer `program_id` on session |
| Medical / overtraining | No “you’re overtraining” diagnosis—report counts only |

---

### 17.13 Configuration

Add to `backend/.env.example`:

```bash
COACH_MISSED_DAYS_THRESHOLD=7      # days without a body part → "stale / missed"
COACH_REPEAT_THRESHOLD=3           # sessions in range → "repeated"
COACH_SPLIT_MAX_RANGE_DAYS=90      # max analyze_training_split window
COACH_SESSION_HISTORY_LIMIT=60     # max sessions per get_session_history
```

---

## 18. Testing strategy

### 18.1 Backend unit tests

- `buildCoachContext` with fixture rows: empty day, full day, timezone edge (UTC+14).
- `dataQuality.warnings` rules.
- Rate limit counter reset at local midnight (mock clock).

### 18.2 Backend integration tests

- Hit `POST /coach/chat` with mocked LLM (inject `coachLlm` stub).
- Verify 401 without JWT.

### 18.3 Manual E2E (API mode)

1. Log meals on Diet → ask coach about protein → numbers match.
2. Complete workout → ask about volume → matches History day.
3. New user with no data → coach encourages logging.
4. 31st message → 429.

### 18.4 Workout intelligence tests (Phase 2b)

Use scenarios from [§17.10](#1710-exit-criteria) as automated or manual regression.

- `resolveBodyPart`: program title, keyword fallback, unknown tie
- `analyzeTrainingSplit`: missed / repeated / suggestedNext priority order
- E2E: 4 Chest sessions + ask “what did I miss?” → Back in reply

### 18.5 Prompt regression suite (optional)

Store golden `USER_DATA` fixtures + snapshot expected bullet themes (not exact wording).

---

## 19. Observability and operations

### 19.1 Logging (pino)

Child logger: `{ module: 'coach' }`

| Event | Level | Fields |
|-------|-------|--------|
| Brief generated | info | userId, date, latencyMs, cached |
| Chat completed | info | userId, promptTokens, completionTokens |
| LLM error | error | userId, err, provider |
| Rate limited | warn | userId |

### 19.2 Metrics (future)

- `coach_requests_total{endpoint,status}`
- `coach_llm_latency_seconds`
- `coach_tokens_total{direction}`

### 19.3 Feature launch checklist

- [ ] API keys in production secrets (not git)
- [ ] Rate limits enabled
- [ ] Privacy policy mentions AI processing
- [ ] `RELEASE_NOTES.md` entry
- [ ] Update `ARCHITECTURE.md` and `GET /v1` route list

---

## 20. Future enhancements

| Enhancement | Depends on |
|-------------|------------|
| Split-aware coaching (missed / repeat / next) | **Phase 2b** — [§17](#17-phase-2b--workout-intelligence) |
| Weekly trend charts interpreted by coach | Analytics / charts feature |
| “Compare to my average Monday” | 30+ days history + aggregates |
| Voice input | Expo speech APIs |
| Coach remembers user preferences | `coach_user_prefs` table |
| Integration with food vision | Confirmed meals from vision pipeline |
| RAG over exercise wiki | External corpus—not user DB |
| Multi-language | i18n layer on prompts + UI |

---

## 21. Open decisions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Primary UX entry | Fifth tab vs Home stack vs FAB | _TBD_ |
| 2 | Coach persona | Analyst vs gym buddy | _TBD_ |
| 3 | LLM provider | OpenAI vs Anthropic | _TBD_ |
| 4 | Context format to model | JSON vs markdown | _TBD_ |
| 5 | Persist chat history in v2? | Yes / ephemeral only | _TBD_ |
| 6 | Show coach in `USE_LOCAL`? | Mock vs hidden | _TBD_ |
| 7 | Streaming in v2? | SSE vs wait for full reply | _TBD_ |
| 8 | Protein goal source | Hardcoded heuristic vs profile field | _TBD_ |
| 9 | `program_id` on session | Required for 2b vs optional | _Recommend required on new sessions_ |
| 10 | Repeat threshold | 3 vs 4 sessions per month | _TBD_ — default 3 |
| 11 | Missed = zero sessions vs stale N days | Zero only vs 7-day stale rule | _TBD_ — default both |

---

## 22. Appendix: codebase references

### 22.1 Existing backend routes to mirror

| Route | File | Use for coach context |
|-------|------|------------------------|
| `GET /user/profile` | `backend/src/routes/v1/user.ts` | displayName |
| `GET /user/dashboard-summary` | `backend/src/routes/v1/user.ts` | todayKcal, goalKcal, macros, lastWorkoutDaysAgo |
| `GET /history/day?date=` | `backend/src/routes/v1/history.ts` | Full day meals + sessions + stats |
| `GET /history/calendar?from=&to=` | `backend/src/routes/v1/history.ts` | Weekly consistency |
| `GET /sessions/active` | `backend/src/routes/v1/sessions.ts` | Active workout flag |
| `GET /programs` | `backend/src/routes/v1/programs.ts` | Phase 2b — user training split |

### 22.2 Existing libraries

| Module | Path |
|--------|------|
| Session stats | `backend/src/lib/workoutStats.ts` |
| Timezone | `backend/src/lib/clientTimeZone.ts` |
| Auth middleware | `backend/src/middleware/requireUser.ts` |
| Mobile TZ helper | `mobile/src/lib/clientTimeZone.ts` |
| API client | `mobile/src/services/api.ts` |

### 22.3 Schema (*existing*)

| Table | Relevant columns |
|-------|------------------|
| `app_user` | `display_name`, `goal_kcal`, `avatar_uri` |
| `meal` | `name`, `kcal`, `protein`, `carbs`, `fats`, `created_at` |
| `workout_session` | `started_at`, `ended_at`, `exercises` (JSONB) |
| `workout_program` | `title`, `day_label`, `blocks` — Phase 2b expected split |

Defined in `backend/sql/002_api_core.sql`. Phase 2b migration: `006_coach_workout_intelligence.sql` (`program_id` on session).

### 22.4 Mobile types (*existing*)

| Type | Path |
|------|------|
| `Macros`, `DailySummary`, `Meal` | `mobile/src/types/meal.ts` |
| `SessionStats`, `ExerciseEntry` | `mobile/src/types/workout.ts` |
| `DashboardSummary` | `mobile/src/types/user.ts` |

### 22.5 Product status context

As of **2026-05-29** ([STATUS_REPORT.md](../STATUS_REPORT.md)):

- History calendar + day detail: **shipped**
- Client timezone on APIs: **shipped**
- Calories burned: **not started** (coach should not claim burn data until shipped)
- Profile `PATCH` for goals: **not started** (coach uses `goal_kcal` from DB default 2500)

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-29 | Initial specification (planned feature) |
| 2026-05-30 | Added §17 Phase 2b — Workout intelligence (split analysis, tools, schema) |

---

*When implementation starts, update this doc’s status, check off phases, and link PRs in the document history.*
