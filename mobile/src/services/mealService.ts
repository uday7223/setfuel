/**
 * Meal service — async CRUD backed by local seed data.
 *
 * To switch to live API:
 *   Replace the function bodies with apiFetch() calls.
 *   Types and signatures stay identical.
 */

import type { CreateMealPayload, DailySummary, Macros, Meal } from '../types';
import { localId, USE_LOCAL } from './api';

const DAILY_GOAL_KCAL = 2500;

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
}

const SEED_MEALS: Meal[] = [
  {
    id: 'seed-1',
    name: 'Greek Yogurt Bowl',
    kcal: 420,
    time: '08:30 AM',
    createdAt: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAy-p69qzU3GSJYObi5UKQeX2UaGnxIDPopDotwxioBd2Tv5SF1wZb52HM5hZfM5BRIfgRXq1-G0aG-VktLCdgIVTW8VwYYYTBZxGHc76jiQHMN786jXxab7eWda8z5aeXYWrE2GBApdYmDEoFDLmHykUmF4OR_iMixCwqreuWG-TIj5z2z6ssXuLvCvvt84XhRIMhcG4AUjghgFCwZ25Nn3LZC8Dp7pjQu7Iw2lkH_EUoD9hAym6t2FsKYd6-U06bOt1QKbnqIr5c',
    macros: { protein: 32, carbs: 48, fats: 12 },
  },
  {
    id: 'seed-2',
    name: 'Quinoa Salmon Salad',
    kcal: 680,
    time: '01:15 PM',
    createdAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD-yEdvS96bvjLi_8aZHR7pERJe7FcWyjkq3JzkoxV8B2_PIvbVpYaMH-YmBDMmS6Uj13QZYEGVP29gUYXVBrP60yZnonATQTEufhuTGA3QX9yY1eKvvAQaTQONP-Oucw4h7WhXJupS4NZ18QbAlWlKUZOSpxfU1n2RRpgFoWYKeaE-3fBgBTeltTKi14ukg88gaabZ_MEh-_H4AzGJbeircPtHGxIQODb6uJA6k4Qxfr0zERDwHWyqHbDhu_4qjhlrlJbRUJQQ2bo',
    macros: { protein: 58, carbs: 72, fats: 24 },
  },
  {
    id: 'seed-3',
    name: 'Mixed Raw Nuts',
    kcal: 250,
    time: '04:45 PM',
    createdAt: new Date(Date.now() - 1 * 60 * 60_000).toISOString(),
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAjvhcA0laOIVAm1z2yWPYW9FN0Q4aN9F07ncspZtQ22dHN3bWCucXobB3KgB4Y5CVmQVpaRNuu8lW_fwe_VzjsMp62yfMgDgRsdyPC9574VGG-iKuqRYirAQCmhy9ik6NceYQWjpdUhRAOOqiNaHkJda0c68GjgVF3z6jAHyRy864WZ-OTfVZPhRIkFdSP143O1JqfuwG2mS4D91xPal0n4MY5DKuWFatsavRmkAKJAIOz2ZA_M_pRkFUCycnEudKrhBbWQiAIsCQ',
    macros: { protein: 8, carbs: 12, fats: 18 },
  },
];

let _localMeals: Meal[] = [...SEED_MEALS];

function resetLocalMeals() {
  _localMeals = [...SEED_MEALS];
}

/* ── Public API ───────────────────────────────────────────── */

export async function getMeals(): Promise<Meal[]> {
  if (USE_LOCAL) return [..._localMeals];
  // return apiFetch<Meal[]>('/meals');
  return [];
}

export async function addMeal(payload: CreateMealPayload): Promise<Meal> {
  const now = new Date();
  const meal: Meal = {
    id: localId(),
    name: payload.name,
    kcal: payload.kcal,
    time: formatTime(now),
    createdAt: now.toISOString(),
    imageUri: payload.imageUri,
    macros: payload.macros,
  };

  if (USE_LOCAL) {
    _localMeals = [meal, ..._localMeals];
    return meal;
  }
  // return apiFetch<Meal>('/meals', { method: 'POST', body: payload });
  return meal;
}

export async function removeMeal(id: string): Promise<void> {
  if (USE_LOCAL) {
    _localMeals = _localMeals.filter((m) => m.id !== id);
    return;
  }
  // return apiFetch<void>(`/meals/${id}`, { method: 'DELETE' });
}

export async function getDailySummary(): Promise<DailySummary> {
  if (USE_LOCAL) {
    const totals = _localMeals.reduce<Macros>(
      (acc, m) => ({
        protein: acc.protein + (m.macros?.protein ?? 0),
        carbs: acc.carbs + (m.macros?.carbs ?? 0),
        fats: acc.fats + (m.macros?.fats ?? 0),
      }),
      { protein: 0, carbs: 0, fats: 0 },
    );
    return {
      totalKcal: _localMeals.reduce((s, m) => s + m.kcal, 0),
      goalKcal: DAILY_GOAL_KCAL,
      macros: totals,
      mealsLogged: _localMeals.length,
    };
  }
  // return apiFetch<DailySummary>('/meals/daily-summary');
  return { totalKcal: 0, goalKcal: DAILY_GOAL_KCAL, macros: { protein: 0, carbs: 0, fats: 0 }, mealsLogged: 0 };
}

export { DAILY_GOAL_KCAL, resetLocalMeals };
