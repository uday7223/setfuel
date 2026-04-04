/** Authenticated user profile. */
export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUri?: string;
};

/** High-level dashboard data surfaced on the Home screen. */
export type DashboardSummary = {
  lastWorkoutDaysAgo: number;
  todayKcal: number;
  goalKcal: number;
  nutritionProgress: number;
};
