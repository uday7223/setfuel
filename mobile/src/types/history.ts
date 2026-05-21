import type { ExerciseEntry, WorkoutSession } from './workout';
import type { Meal, Macros } from './meal';

export type SessionStats = {
  exerciseCount: number;
  setCount: number;
  setsCompleted: number;
  volumeKg: number;
  durationMs: number | null;
  durationMinutes: number | null;
};

export type WorkoutSessionWithStats = WorkoutSession & {
  stats: SessionStats;
};

export type HistoryCalendarDay = {
  date: string;
  hasWorkout: boolean;
  hasMeals: boolean;
  sessionCount: number;
  mealCount: number;
};

export type HistoryCalendarResponse = {
  from: string;
  to: string;
  days: HistoryCalendarDay[];
};

export type DayDietSummary = {
  totalKcal: number;
  goalKcal: number;
  mealsLogged: number;
  macros: Macros;
  nutritionProgress: number;
};

/** Day detail payload from GET /history/day (renamed to avoid clash with route name HistoryDayDetail). */
export type DayHistoryDetail = {
  date: string;
  sessions: WorkoutSessionWithStats[];
  meals: Meal[];
  dietSummary: DayDietSummary;
};
