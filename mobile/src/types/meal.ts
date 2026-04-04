/** Macro-nutrient breakdown attached to a meal. */
export type Macros = {
  protein: number;
  carbs: number;
  fats: number;
};

/** A single logged meal entry. Matches the shape the API will return. */
export type Meal = {
  id: string;
  name: string;
  kcal: number;
  /** Display-friendly time string (e.g. "08:30 AM"). */
  time: string;
  /** ISO 8601 timestamp — authoritative; `time` is derived for display. */
  createdAt: string;
  imageUri?: string;
  macros?: Macros;
};

/** Payload for creating a new meal (no id — server assigns it). */
export type CreateMealPayload = {
  name: string;
  kcal: number;
  imageUri?: string;
  macros?: Macros;
};

/** Aggregated daily summary returned by the dashboard / diet screen. */
export type DailySummary = {
  totalKcal: number;
  goalKcal: number;
  macros: Macros;
  mealsLogged: number;
};
