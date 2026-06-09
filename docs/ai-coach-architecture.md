# SetFuel AI Coach — System Architecture

| | |
|---|---|
| **Status** | Design (adapted from production reference) |
| **Last updated** | 2026-05-29 |
| **Source reference** | [Conversational-AI-Architecture-Report.html](../Conversational-AI-Architecture-Report.html) (FoodSupply.AI) |
| **Companion spec** | [ai-coach-feature.md](./ai-coach-feature.md) (product + API detail) |
| **Platform** | SetFuel — Expo mobile + Express + PostgreSQL (Neon) |

---

## Table of contents

1. [Vision](#1-vision)
2. [Reference vs SetFuel mapping](#2-reference-vs-setfuel-mapping)
3. [Architecture overview](#3-architecture-overview)
4. [Components](#4-components)
5. [Orchestrator design](#5-orchestrator-design)
6. [Coach tools (execution layer)](#6-coach-tools-execution-layer)
7. [Security architecture](#7-security-architecture)
8. [Session and context strategy](#8-session-and-context-strategy)
9. [Request lifecycle](#9-request-lifecycle)
10. [Technology stack](#10-technology-stack)
11. [POC scope vs post-POC](#11-poc-scope-vs-post-poc)
12. [File and module layout](#12-file-and-module-layout)
13. [Open decisions](#13-open-decisions)

---

## 1. Vision

SetFuel users ask natural-language questions about **their own** workout and diet logs:

- *"How am I doing on calories today?"*
- *"What did I train in my last session?"*
- *"How many days did I work out this week?"*
- *"Should I eat more protein before tonight's gym?"*

The coach returns accurate, **user-specific** answers drawn from PostgreSQL—not generic fitness advice.

### Design principle

> **No dashboards to interpret. No spreadsheets. Just ask.**

Same principle as the FoodSupply.AI reference, applied to personal fitness data instead of restaurant operations.

### How it works (SetFuel adaptation)

The reference system uses an **agentic tool loop**: the LLM selects tools, the execution layer runs read-only queries, results feed back until the model produces a final text answer.

SetFuel adopts that pattern but **simplifies deployment**:

| Reference (FoodSupply) | SetFuel adaptation |
|------------------------|-------------------|
| LLM generates dynamic SQL | **Parameterized coach tools** wrap known SQL (reuse `history.ts`, `user.ts` patterns) |
| 6 separate machines | **Single Express backend** with a `coach/` module |
| Python LangGraph orchestrator | **TypeScript orchestrator** in-process (LangGraph-style roles, no Python service) |
| MCP Server over HTTP | **In-process tool registry** (MCP-inspired interface; optional external MCP later) |
| MySQL `chatbot_views` | PostgreSQL **coach views** + `user_id` scoping |
| Redis session store | **PostgreSQL session tables** first; Redis optional at scale |
| Multi-store RBAC | **Single-user JWT** (`requireUser` → `user_id`) |

### Key capabilities (phased)

| Capability | Phase |
|------------|-------|
| Read-only answers from logged meals and workouts | POC |
| Multi-step tool chains (fetch day → compute → summarize) | POC |
| Conversational follow-ups with compressed history | POC |
| Interactive clarification (`resolve_params`) | Post-POC |
| Dynamic SQL over coach views | Post-POC (if needed) |
| Streaming SSE responses | Post-POC |
| ML predictions (calories burned, etc.) | Post-POC |

---

## 2. Reference vs SetFuel mapping

### 2.1 Machine / component map

```text
FoodSupply.AI (reference)          SetFuel (this architecture)
─────────────────────────          ───────────────────────────

Machine A: Next.js App             mobile/ — Expo React Native
  └─ Chat UI (browser)               └─ CoachScreen.tsx
  └─ POST /api/chat                  └─ coachService → POST /v1/coach/chat
  └─ NextAuth + RBAC                └─ JWT Bearer + requireUser

Machine D: Orchestrator              backend/src/coach/
  └─ LangGraph (Python)              └─ coachOrchestrator.ts (TypeScript)
  └─ LiteLLM                         └─ coachLlm.ts (OpenAI SDK or Vercel AI SDK)
  └─ Redis sessions                  └─ coachSession.ts → PostgreSQL (or memory POC)

Machine C: MCP Server                backend/src/coach/tools/
  └─ 5 MCP tools over HTTP           └─ In-process ToolRegistry
  └─ Prisma → MySQL                  └─ pg pool → PostgreSQL

Machine B: MySQL                     PostgreSQL (Neon) — existing schema
  └─ chatbot_views                   └─ coach_views schema (new, read-only)

Machine E: ML Service                Not in POC — defer until calories-burned ML exists
Ext: LLM API                         OpenAI / Anthropic (server-side only)
```

### 2.2 Why simplify for SetFuel?

| Factor | Reference needs 6 machines | SetFuel can consolidate |
|--------|---------------------------|-------------------------|
| Data model | 22 Prisma models, multi-tenant stores | 4 core tables, single user per request |
| Query complexity | Ad-hoc SQL ("spend on fish this month") | Bounded domains: today, day, calendar, session |
| Team / ops | Enterprise POC with network isolation | Monorepo, one API deploy (Neon + Express) |
| Auth | org_id + authorized_store_ids | `user_id` from JWT |

The **patterns** (orchestrator roles, read-only tools, 3 security layers, session memory) stay. The **topology** shrinks to fit a mobile fitness app.

---

## 3. Architecture overview

### 3.1 System diagram

```text
                          ┌──────────────────────┐
                          │     LLM API           │
                          │  (OpenAI / Anthropic) │
                          │                       │
                          │  - Intent recognition │
                          │  - Tool selection     │
                          │  - Response synthesis │
                          └───────────┬──────────┘
                                      │ HTTPS (server only)
                                      │
┌─────────────┐   HTTPS    ┌──────────┴──────────────────────────────────┐
│             │ ────────→  │         EXPRESS BACKEND (backend/)         │
│  MOBILE     │            │                                            │
│  Coach UI   │ ←────────  │  ┌─────────────────────────────────────┐  │
│             │            │  │  /v1/coach/chat                     │  │
│  Expo RN    │            │  │  /v1/coach/daily-brief              │  │
│             │            │  └──────────────┬──────────────────────┘  │
└─────────────┘            │                 │                             │
                           │  ┌──────────────▼──────────────────────┐  │
                           │  │  AUTH: requireUser (JWT)            │  │
                           │  │  → res.locals.userId                │  │
                           │  └──────────────┬──────────────────────┘  │
                           │                 │                             │
                           │  ┌──────────────▼──────────────────────┐  │
                           │  │  COACH ORCHESTRATOR (TypeScript)    │  │
                           │  │                                     │  │
                           │  │  1. Session Manager                 │  │
                           │  │  2. Context Builder                 │  │
                           │  │  3. LLM Caller (agentic loop)       │  │
                           │  │  4. Tool Router                     │  │
                           │  │  5. Response Builder                │  │
                           │  └───────┬─────────────────┬───────────┘  │
                           │          │                 │               │
                           │          │ in-process      │ read/write    │
                           │          ▼                 ▼               │
                           │  ┌──────────────┐  ┌──────────────────┐   │
                           │  │ TOOL REGISTRY│  │ SESSION STORE    │   │
                           │  │ (coach/tools)│  │ (PostgreSQL)     │   │
                           │  │              │  │                  │   │
                           │  │ get_day      │  │ coach_conversation│  │
                           │  │ get_calendar │  │ coach_message    │   │
                           │  │ get_profile  │  │ coach_turn_trace │   │
                           │  │ compute      │  └──────────────────┘   │
                           │  │ resolve_*    │                          │
                           │  └──────┬───────┘                          │
                           │         │ parameterized SQL only          │
                           │         ▼                                 │
                           │  ┌──────────────────────────────────┐    │
                           │  │  PostgreSQL (Neon)              │    │
                           │  │  ┌────────────────────────────┐ │    │
                           │  │  │ coach_views.* (read-only)  │ │    │
                           │  │  └────────────────────────────┘ │    │
                           │  │  ┌────────────────────────────┐ │    │
                           │  │  │ public: meal, workout_*,   │ │    │
                           │  │  │         app_user (app API) │ │    │
                           │  │  └────────────────────────────┘ │    │
                           │  └──────────────────────────────────┘    │
                           └────────────────────────────────────────────┘
```

### 3.2 Network rules (SetFuel)

| Connection | Protocol | Notes |
|------------|----------|-------|
| Mobile → Express | HTTPS + Bearer JWT | Same as existing `/v1/meals`, `/v1/history` |
| Express → LLM API | HTTPS outbound | API keys in `backend/.env` only |
| Express → PostgreSQL | `pg` pool (TLS) | Neon connection string |
| Mobile → LLM | **Never** | Keys must not ship in the app |

### 3.3 Timezone

All date-scoped tools accept client timezone the same way as existing APIs:

- Query: `timeZone`, `tzOffsetMinutes` (see `mobile/src/lib/clientTimeZone.ts`)
- Server: `getClientTimeZone()`, `getLocalDateExpr()` (see `backend/src/lib/clientTimeZone.ts`)

Coach "today" must match Diet and History screens.

---

## 4. Components

### 4.1 Chat UI — Mobile (`mobile/`)

**Location:** `mobile/src/screens/coach/CoachScreen.tsx`  
**Stack:** Expo SDK 54, React Native, existing `dashboard` theme

| Does | Does NOT |
|------|----------|
| Render messages and suggested prompt chips | Call LLM API directly |
| `POST /v1/coach/chat` via `coachService` | Query PostgreSQL |
| Hold `sessionId` in screen state | Decide which tools to run |
| Show daily brief on Home (`DailyBriefCard`) | Store server session (server owns persistence) |
| Render clarification UI (post-POC) | Build coach context |

**Request / response (no streaming in POC):**

```typescript
// POST /v1/coach/chat
// Request
{
  sessionId?: string;           // omit → server creates session
  message: string;
  date?: string;                // YYYY-MM-DD focus date
  clarification?: {              // post-POC: resume after interrupt
    param: string;
    value: string;
  };
}

// Response
{
  type: 'answer' | 'clarification';
  sessionId: string;
  text: string;
  data?: {                       // optional structured payload
    citations?: { type: 'meal' | 'session'; id: string; label: string }[];
  };
  questions?: {                  // only if type === 'clarification'
    param: string;
    question: string;
    options: { value: string; label: string }[];
  }[];
}
```

### 4.2 API gateway — Express routes

**Location:** `backend/src/routes/v1/coach.ts`  
**Middleware chain:** `requireUser` → rate limit → orchestrator

Passes authenticated context to orchestrator:

```typescript
type CoachUserContext = {
  userId: number;
  displayName: string;
  goalKcal: number;
  timeZone: string;
};
```

Loaded once per request from `app_user` + JWT `res.locals.userId`.

### 4.3 Coach orchestrator

**Location:** `backend/src/coach/orchestrator.ts`  
**Role:** Central coordination—the LLM is stateless; the orchestrator provides memory, tools, and auth scope.

See [§5 Orchestrator design](#5-orchestrator-design).

### 4.4 LLM API (external)

| Does | Does NOT |
|------|----------|
| Understand intent | Maintain session state |
| Select tools (function calling) | Execute DB queries |
| Synthesize natural language from tool results | Enforce `user_id` scope |
| Plan multi-step chains | Store conversation history |

**System prompt includes:**

- Coach persona and safety rules
- Tool usage guidelines
- `dataQuality` warnings from context builder
- User's `goalKcal` and focus date
- **Not** raw full schema in POC—tool descriptions instead

### 4.5 Tool registry (execution layer)

**Location:** `backend/src/coach/tools/`  
**Pattern:** MCP-inspired tool interface, executed **in-process** (no separate Machine C).

Replaces FoodSupply's MCP Server for SetFuel's scale. Tools are the **only** path from coach to fitness data.

See [§6 Coach tools](#6-coach-tools-execution-layer).

### 4.6 Session store

**Location:** PostgreSQL tables (see [§8](#8-session-and-context-strategy))  
**Replaces:** Redis + LangGraph checkpointer from reference

| Stored | Purpose |
|--------|---------|
| `sessionId`, `userId` | Conversation identity |
| Turn history (user + assistant messages) | Multi-turn chat |
| Tool traces per turn | Debug + follow-up context |
| `resultData` from last turn | "What's the average of those?" |
| Interrupt state (post-POC) | `resolve_params` resume |

**Lifecycle:**

| Event | Action |
|-------|--------|
| First message | Create `coach_conversation` row |
| Each turn | Append `coach_message` + optional `coach_turn_trace` |
| Inactivity | TTL 24–72h (cron or lazy expiry) |
| User returns | Load session by `sessionId` + verify `userId` |

### 4.7 PostgreSQL data layer

**Existing tables (app CRUD):** `app_user`, `meal`, `workout_session`, `workout_program`  
**New for coach (read-only access):** `coach_views` schema

Coach tools query **views only**, never raw tables directly (Layer 2 security).

---

## 5. Orchestrator design

Adapted from the reference's **5 roles** (LangGraph graph logic reimplemented in TypeScript).

### 5.1 The five roles

| # | Role | Responsibility | SetFuel module |
|---|------|----------------|----------------|
| 1 | **Session Manager** | Load/create session; attach `CoachUserContext`; reject cross-user access | `coach/session.ts` |
| 2 | **Context Builder** | Build LLM messages array; compress old turns; attach `resultData` from prior turn | `coach/contextBuilder.ts` |
| 3 | **LLM Caller** | Call provider with tools; run agentic loop until text response | `coach/llm.ts` |
| 4 | **Tool Router** | Dispatch tool calls to registry; handle `resolve_params` locally | `coach/toolRouter.ts` |
| 5 | **Response Builder** | Format API payload; persist trace; extract citations | `coach/responseBuilder.ts` |

### 5.2 Agentic loop

Same loop as the reference—implemented as a `while` loop in TypeScript (max iterations: 8).

```text
        ┌─────────────────┐
        │   Call LLM      │◄────────────────┐
        └────────┬────────┘                 │
                 │                           │
       ┌─────────▼─────────┐                │
       │  Response type?    │                │
       ├── text ───→ Done   │                │
       └── tool_use ────────┼──→ Execute     │
                            │    tool(s)      │
                            │       │         │
                            │       └─────────┘
                            │    Append tool results to messages
```

| Iterations | Example |
|------------|---------|
| 1 | Simple: pre-built context + one LLM call (daily brief) |
| 2 | "How's my week?" → `get_calendar` → synthesize |
| 3+ | "Compare protein today vs 7-day avg" → `get_day` + `get_weekly_nutrition` + `compute` |

### 5.3 Context compression strategy

Copied from reference §3.3—reduces tokens on long threads.

| Turn age | Sent to LLM | Rationale |
|----------|-------------|-----------|
| Old (1 … N−2) | User message + **one-line assistant summary** | Drop intermediate tool noise |
| Recent (N−1) | Summary + **`resultData` attached** | Follow-ups reference prior numbers |
| Current (N) | Full user message | Always complete |

### 5.4 State schema (TypeScript)

```typescript
type CoachSessionState = {
  sessionId: string;
  userContext: CoachUserContext;
  messages: LlmMessage[];           // provider message format
  pendingToolCalls: ToolCall[];
  resultData: Record<string, unknown> | null;
  turnCount: number;
  interrupt?: {                    // post-POC
    param: string;
    question: string;
    options: { value: string; label: string }[];
  };
};
```

### 5.5 `resolve_params` (post-POC)

In the reference, this is a **local orchestrator tool** (not MCP) that triggers a LangGraph interrupt.

**SetFuel adaptation (without Python LangGraph):**

1. LLM calls `resolve_params({ missingParams: [...] })`
2. Orchestrator saves full `CoachSessionState` to DB with `status: 'awaiting_clarification'`
3. Returns `{ type: 'clarification', questions: [...] }` to mobile
4. Mobile renders chips/dropdowns
5. Next request includes `clarification: { param, value }` → orchestrator resumes from saved state

Example: *"Show me a report for last week"* → coach asks which week if ambiguous.

**POC shortcut:** Suggested prompt chips cover most cases; defer `resolve_params` until chat is stable.

### 5.6 Daily brief path (fast lane)

`GET /v1/coach/daily-brief` bypasses the full agentic loop:

```text
requireUser → buildCoachContext() → single LLM call → cache → return bullets
```

Uses `coach/context.ts` (eager context) instead of tool discovery. Matches [ai-coach-feature.md](./ai-coach-feature.md) Phase 1.

---

## 6. Coach tools (execution layer)

SetFuel tools replace FoodSupply's `discover_schema`, `query_database`, `compute`, `format_result`, `run_ml_model` with **domain-specific, parameterized** functions.

### 6.1 Design rule

> **No free-form SQL from the LLM in POC.**  
> Each tool maps to reviewed SQL with bound parameters and mandatory `user_id` filter.

Post-POC: optional `query_coach_view` with SQL parser + allowlist (reference Layer 3 pattern) if ad-hoc questions outgrow fixed tools.

### 6.2 Tool catalog

#### Tool 1: `get_profile`

| Field | Value |
|-------|-------|
| Purpose | User display name, calorie goal |
| Input | `{}` |
| Output | `{ displayName, goalKcal }` |
| SQL source | `user.ts` profile query |

#### Tool 2: `get_day_detail`

| Field | Value |
|-------|-------|
| Purpose | Meals, workouts, diet summary for one local date |
| Input | `{ date: "YYYY-MM-DD" }` |
| Output | Same shape as `GET /history/day` |
| SQL source | `history.ts` day handler |

#### Tool 3: `get_calendar`

| Field | Value |
|-------|-------|
| Purpose | Which days had workouts/meals in a range |
| Input | `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` |
| Output | `{ days: [{ date, hasWorkout, hasMeals, sessionCount, mealCount }] }` |
| SQL source | `history.ts` calendar handler |

#### Tool 4: `get_dashboard_summary`

| Field | Value |
|-------|-------|
| Purpose | Today's kcal, macros, last workout recency |
| Input | `{}` (uses client TZ for "today") |
| Output | `DashboardSummary` + macros |
| SQL source | `user.ts` dashboard-summary |

#### Tool 5: `get_last_session`

| Field | Value |
|-------|-------|
| Purpose | Most recent completed workout with stats |
| Input | `{}` |
| Output | Session + `computeSessionStats()` from `workoutStats.ts` |
| SQL source | Latest `workout_session` where `ended_at IS NOT NULL` |

#### Tool 6: `get_weekly_nutrition`

| Field | Value |
|-------|-------|
| Purpose | Per-day kcal totals for last N days |
| Input | `{ days: number }` (max 30) |
| Output | `{ days: [{ date, totalKcal, mealsLogged }] }` |
| SQL source | New aggregate query (calendar + meal sums) |

#### Tool 7: `compute`

| Field | Value |
|-------|-------|
| Purpose | Accurate math the LLM should not do |
| Input | `{ operation: "mean" \| "sum" \| "expression", values: number[] }` |
| Output | `{ result: number }` |
| Why | Same rationale as reference—LLMs are unreliable at arithmetic |

#### Tool 8: `resolve_params` (local, post-POC)

| Field | Value |
|-------|-------|
| Purpose | Ask user to pick date range, etc. |
| Handled by | Orchestrator only—never hits PostgreSQL |

#### Tool 9: `format_result` (optional)

| Field | Value |
|-------|-------|
| Purpose | Structure data for future rich UI (tables in chat) |
| POC | Skip—mobile renders text only |

### 6.3 Tool interface (TypeScript)

```typescript
type CoachToolContext = {
  userId: number;
  timeZone: string;
  pool: Pool;
};

type CoachTool<TInput, TOutput> = {
  name: string;
  description: string;          // shown to LLM
  parameters: JsonSchema;       // OpenAI function parameters
  execute: (ctx: CoachToolContext, input: TInput) => Promise<TOutput>;
};

// Registry
const toolRegistry = new Map<string, CoachTool<unknown, unknown>>();
```

### 6.4 `coach_views` schema (PostgreSQL)

Equivalent to reference `chatbot_views` on MySQL.

**Migration:** `backend/sql/004_coach_views.sql`

```sql
CREATE SCHEMA IF NOT EXISTS coach_views;

CREATE OR REPLACE VIEW coach_views.meals AS
  SELECT
    id,
    user_id,
    name,
    kcal,
    time_display,
    created_at,
    protein,
    carbs,
    fats
  FROM meal;

CREATE OR REPLACE VIEW coach_views.workout_sessions AS
  SELECT
    id,
    user_id,
    started_at,
    ended_at,
    exercises
  FROM workout_session
  WHERE ended_at IS NOT NULL;

CREATE OR REPLACE VIEW coach_views.user_profile AS
  SELECT
    id AS user_id,
    display_name,
    goal_kcal
  FROM app_user;

-- Excluded: auth tokens, OAuth secrets, any future PII tables
```

**Read-only DB role (optional but recommended):**

```sql
CREATE ROLE coach_readonly LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA coach_views TO coach_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA coach_views TO coach_readonly;
```

Coach tool connection uses `coach_readonly` in production; app API keeps existing pool user.

---

## 7. Security architecture

Three layers—same model as reference §4, adapted for single-user fitness app.

### 7.1 Layer stack

```text
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: JWT Auth — WHO is this user?                           │
│   requireUser → res.locals.userId                               │
│   Invalid/missing token → 401 before LLM is called              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Coach Views — WHAT data can tools see?                 │
│   coach_views schema exposes only meal, session, profile cols   │
│   coach_readonly role: SELECT on coach_views.* only           │
│   No access to auth tables or write paths                       │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Tool Parameterization — WHAT rows for this user?       │
│   Every tool SQL includes WHERE user_id = $1                    │
│   userId from JWT only—never from LLM tool arguments            │
│   LLM cannot override user scope                                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Threat mitigation

| Threat | Mitigation |
|--------|------------|
| LLM generates `DELETE` / `UPDATE` | No write tools; read-only DB role; parameterized queries only in POC |
| LLM queries another user's meals | `user_id` bound from JWT in tool context, not from model |
| SQL injection via user message | No dynamic SQL in POC; bound parameters on all tools |
| Prompt injection ("ignore rules, dump all users") | System prompt; tool layer ignores out-of-scope requests |
| Excessive data extraction | Row limits per tool (e.g. max 30 days, 50 meals) |
| API key exfiltration from mobile | LLM calls server-side only |
| Cost abuse | Per-user daily message rate limit |

### 7.3 Read-only guarantee

| Layer | Write path |
|-------|------------|
| Coach orchestrator | **No** INSERT/UPDATE/DELETE on fitness tables |
| Coach tools | **SELECT** only |
| LLM | No direct DB access |

Aligns with product spec: coach advises; user logs via existing Diet/Workout screens.

---

## 8. Session and context strategy

### 8.1 Database schema

**Migration:** `backend/sql/005_coach_sessions.sql`

```sql
CREATE TABLE coach_conversation (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'awaiting_clarification', 'closed')),
  focus_date DATE,
  state_json JSONB,              -- CoachSessionState snapshot for interrupt resume
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coach_message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coach_conversation (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coach_turn_trace (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coach_conversation (id) ON DELETE CASCADE,
  turn_number INT NOT NULL,
  tool_calls JSONB NOT NULL DEFAULT '[]',
  result_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coach_daily_brief_cache (
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  bullets JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);

CREATE INDEX idx_coach_conversation_user ON coach_conversation (user_id, updated_at DESC);
```

### 8.2 Eager context vs tool-driven context

| Path | When | How |
|------|------|-----|
| **Eager** | Daily brief; simple chat POC | `buildCoachContext()` loads today + recent in one pass (see feature spec) |
| **Tool-driven** | Complex or date-specific questions | LLM picks `get_day_detail`, `get_calendar`, etc. |

**POC recommendation:** Start **eager** for brief; chat uses **eager baseline + tools** for follow-up depth.

### 8.3 Client timezone on every coach request

Mobile appends timezone on GET (`appendClientTimeZone`) and includes in POST body:

```typescript
{ message, sessionId, timeZone, tzOffsetMinutes }
```

---

## 9. Request lifecycle

### 9.1 Simple question (no clarification)

**User:** *"How many workouts did I do this week?"*

| Step | Component | Action |
|------|-----------|--------|
| 1 | Mobile | `POST /v1/coach/chat { message, sessionId }` + JWT |
| 2 | `requireUser` | Verify JWT → `userId = 42` |
| 3 | Session Manager | Load session; attach `CoachUserContext` |
| 4 | Context Builder | System prompt + history + user message |
| 5 | LLM Caller | Returns `tool_use: get_calendar({ from, to })` |
| 6 | Tool Router | Execute with `user_id = 42`; return `{ workoutDays: 3 }` |
| 7 | LLM Caller (loop 2) | Returns text: *"You completed 3 workouts this week."* |
| 8 | Response Builder | Save trace; return `{ type: 'answer', text, sessionId }` |

### 9.2 Follow-up using prior context

**Turn 1:** *"Show me today's meals"* → 3 meals returned in `resultData`  
**Turn 2:** *"What's the average calories?"*

| Step | Action |
|------|--------|
| 1 | Context Builder attaches Turn 1 `resultData` (meal kcals) |
| 2 | LLM calls `compute({ operation: 'mean', values: [420, 680, 250] })` |
| 3 | Returns *"Average meal today is 450 kcal"* — no DB re-query |

### 9.3 Clarification flow (post-POC)

**User:** *"Show me my workout report"*

| Step | Action |
|------|--------|
| 1 | LLM calls `resolve_params` — missing `date_range` |
| 2 | Orchestrator saves state; `status = awaiting_clarification` |
| 3 | Mobile shows: **[Today] [Last 7 days] [This month]** |
| 4 | User taps **Last 7 days** → resume with `clarification` payload |
| 5 | LLM calls `get_calendar` + synthesizes report |

### 9.4 Daily brief (fast lane)

| Step | Action |
|------|--------|
| 1 | `GET /v1/coach/daily-brief?timeZone=...` |
| 2 | Check `coach_daily_brief_cache` for `(userId, localDate)` |
| 3 | If miss: `buildCoachContext()` → single LLM call → cache → return |

---

## 10. Technology stack

| Layer | FoodSupply reference | SetFuel choice | Rationale |
|-------|---------------------|----------------|-----------|
| Chat UI | Next.js 14 (browser) | **Expo React Native** | SetFuel is mobile-first |
| API gateway | Next.js `/api/chat` | **Express `/v1/coach/*`** | Existing backend pattern |
| Auth | NextAuth + store RBAC | **JWT + `requireUser`** | Already shipped |
| Orchestrator | LangGraph (Python) | **TypeScript module** | Same monorepo; no Python ops |
| LLM client | LiteLLM | **OpenAI SDK** or **Vercel AI SDK** | Provider swap via env var |
| Tool protocol | MCP over HTTP | **In-process ToolRegistry** | Simpler; extract to MCP later if needed |
| Database | MySQL + Prisma | **PostgreSQL + `pg` pool** | Neon; matches app |
| Coach data access | `chatbot_views` | **`coach_views` schema** | Same security pattern |
| Session store | Redis | **PostgreSQL tables** | No new infra for POC |
| ML service | FastAPI (Prophet, etc.) | **Deferred** | No ML dependency for coach v1 |
| Logging | — | **pino** (existing) | `module: 'coach'` child logger |
| Mobile HTTP | — | **`apiFetch` + `coachService`** | Matches `mealService` pattern |

### 10.1 Optional future additions

| Addition | When |
|----------|------|
| Redis | High chat volume; sub-ms session reads |
| LiteLLM proxy | Multi-provider routing in one deploy |
| External MCP server | Second data source (e.g. USDA nutrition API) |
| `@langchain/langgraph` (TS) | If interrupt flows become too complex to hand-roll |
| SSE streaming | Better perceived latency on long replies |

---

## 11. POC scope vs post-POC

### 11.1 POC — build now

| Item | Detail |
|------|--------|
| **Daily brief** | `GET /v1/coach/daily-brief` + Home card |
| **Chat endpoint** | `POST /v1/coach/chat` with agentic loop (max 8 iterations) |
| **TypeScript orchestrator** | All 5 roles |
| **Tools 1–7** | `get_profile`, `get_day_detail`, `get_calendar`, `get_dashboard_summary`, `get_last_session`, `get_weekly_nutrition`, `compute` |
| **`coach_views` schema** | meals, workout_sessions, user_profile |
| **Session tables** | `coach_conversation`, `coach_message`, `coach_turn_trace` |
| **Brief cache table** | `coach_daily_brief_cache` |
| **Security** | JWT + parameterized tools + `user_id` scoping |
| **Rate limits** | 30 chat messages / user / local day |
| **Mobile** | `CoachScreen`, `coachService`, `DailyBriefCard` on Home |

### 11.2 Post-POC — build later

| Item | Detail |
|------|--------|
| **`resolve_params` + clarification UI** | Interrupt/resume without LangGraph |
| **`query_coach_view`** | Guarded dynamic SQL (reference `query_database` pattern) |
| **`coach_readonly` DB role** | Separate connection string for tools |
| **Streaming SSE** | Token-by-token reply on mobile |
| **Conversation list UI** | Resume past threads |
| **Citations → deep links** | Tap meal/session in reply → History |
| **Audit log** | `coach_request_log` for compliance |
| **Prompt caching** | Reduce cost on repeated system prompts |
| **Calories burned tool** | When burn feature ships |
| **Food vision → coach** | Confirmed meal flows into context |
| **External MCP** | Nutrition DB, wearable APIs |

---

## 12. File and module layout

```text
backend/
  sql/
    004_coach_views.sql
    005_coach_sessions.sql
  src/
    coach/
      orchestrator.ts       # Main entry: runCoachTurn()
      session.ts            # Role 1: Session Manager
      contextBuilder.ts     # Role 2: message array + compression
      llm.ts                # Role 3: provider + agentic loop
      toolRouter.ts         # Role 4: dispatch to registry
      responseBuilder.ts    # Role 5: API payload + persist trace
      context.ts            # Eager CoachContext for brief
      prompts.ts            # System prompts
      types.ts              # CoachSessionState, ToolCall, etc.
      tools/
        index.ts            # ToolRegistry
        getDayDetail.ts
        getCalendar.ts
        getDashboardSummary.ts
        getLastSession.ts
        getProfile.ts
        getWeeklyNutrition.ts
        compute.ts
    routes/v1/coach.ts      # HTTP handlers
    middleware/
      coachRateLimit.ts     # optional

mobile/
  src/
    screens/coach/
      CoachScreen.tsx
      components/
        DailyBriefCard.tsx
        MessageBubble.tsx
        PromptChips.tsx
    services/coachService.ts
    types/coach.ts
```

### 12.1 Register routes

In `backend/src/routes/v1/index.ts`:

```typescript
v1Router.use('/coach', coachRouter);
```

### 12.2 Environment variables

Add to `backend/.env.example`:

```bash
# AI Coach
COACH_LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
COACH_DAILY_MESSAGE_LIMIT=30
COACH_MAX_TOOL_ITERATIONS=8
COACH_REQUEST_TIMEOUT_MS=25000
# Optional: separate read-only connection for tools
# COACH_DATABASE_URL=postgresql://coach_readonly:...@.../setfuel
```

---

## 13. Open decisions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Orchestrator location | In Express vs separate Node service | **In Express** for POC |
| 2 | Eager vs tool-only context | Preload all data vs LLM fetches | **Eager baseline + tools** |
| 3 | Session store | Postgres vs Redis | **Postgres** for POC |
| 4 | LLM SDK | OpenAI SDK vs Vercel AI SDK | OpenAI SDK (simplest) |
| 5 | Coach tab placement | Fifth tab vs Home stack | Decide in feature spec §20 |
| 6 | `resolve_params` in v1? | Yes / defer | **Defer** to post-POC |
| 7 | Dynamic SQL tool | Yes / never | **Defer**; fixed tools sufficient for fitness domain |

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-29 | Initial architecture — adapted from FoodSupply.AI Conversational AI report |

---

## Related reading

- [ai-coach-feature.md](./ai-coach-feature.md) — product requirements, API payloads, phased checklist
- [ai-food-agent.txt](./ai-food-agent.txt) — separate vision AI for meal photos
- [ARCHITECTURE.md](../ARCHITECTURE.md) — SetFuel monorepo conventions
- [Conversational-AI-Architecture-Report.html](../Conversational-AI-Architecture-Report.html) — source reference architecture
