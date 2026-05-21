import type { DayHistoryDetail, HistoryCalendarResponse, WorkoutSessionWithStats } from '../types';
import { apiFetch, USE_LOCAL } from './api';

export async function getCalendar(from: string, to: string): Promise<HistoryCalendarResponse> {
  if (USE_LOCAL) {
    return { from, to, days: [] };
  }
  const q = new URLSearchParams({ from, to });
  return apiFetch<HistoryCalendarResponse>(`/history/calendar?${q}`);
}

export async function getDayDetail(date: string): Promise<DayHistoryDetail> {
  if (USE_LOCAL) {
    return {
      date,
      sessions: [],
      meals: [],
      dietSummary: {
        totalKcal: 0,
        goalKcal: 2500,
        mealsLogged: 0,
        macros: { protein: 0, carbs: 0, fats: 0 },
        nutritionProgress: 0,
      },
    };
  }
  const q = new URLSearchParams({ date });
  return apiFetch<DayHistoryDetail>(`/history/day?${q}`);
}

export async function listSessions(from: string, to: string): Promise<WorkoutSessionWithStats[]> {
  if (USE_LOCAL) return [];
  const q = new URLSearchParams({ from, to });
  return apiFetch<WorkoutSessionWithStats[]>(`/sessions?${q}`);
}

export async function getSession(id: string): Promise<WorkoutSessionWithStats> {
  if (USE_LOCAL) {
    throw new Error('Session detail requires API mode');
  }
  return apiFetch<WorkoutSessionWithStats>(`/sessions/${id}`);
}
