/**
 * User / dashboard service — async profile and summary data.
 *
 * To switch to live API:
 *   Replace function bodies with apiFetch() calls.
 */

import type { DashboardSummary, UserProfile } from '../types';
import { appendClientTimeZone } from '../lib/clientTimeZone';
import { apiFetch, USE_LOCAL } from './api';

const PLACEHOLDER_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCCMQVXUzlva7_8o4Lhjn4ARRTGZLkm9sVhzy8FsS_vTfVhHeAi2IP-mLsFdk_5Ai-9J3QMG5_2NqVflxHF6rlyzZJ9NyCrnggj_L5-hDAkh3cTC3WSsiF5qOGtiQx-ZOYz9KgkrVyupLQIB6weamUDGSI33Ik7vleC9k4U5mh5P4vMcNg2ng4RQnrXw6SpQxoi_zEgqsQGxaHE5Qyel2zuaPfIF9PkHZp4jWXDQrHuCWRcbb9aLkeHOBRviAO6Yxn9FiQmEkxbBss';

export async function getProfile(): Promise<UserProfile> {
  if (USE_LOCAL) {
    return {
      id: 'local-user-1',
      displayName: 'Uday',
      email: 'uday@setfuel.app',
      avatarUri: PLACEHOLDER_AVATAR,
    };
  }
  return apiFetch<UserProfile>('/user/profile');
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (USE_LOCAL) {
    return {
      lastWorkoutDaysAgo: 2,
      todayKcal: 1850,
      goalKcal: 2500,
      nutritionProgress: 0.72,
    };
  }
  const q = appendClientTimeZone(new URLSearchParams());
  return apiFetch<DashboardSummary>(`/user/dashboard-summary?${q}`);
}

export { PLACEHOLDER_AVATAR };
