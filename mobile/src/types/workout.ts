/** A single logged set within an exercise. */
export type SetEntry = {
  id: string;
  reps: string;
  weightKg: string;
  done: boolean;
};

/** An exercise block containing one or more sets. */
export type ExerciseEntry = {
  id: string;
  name: string;
  sets: SetEntry[];
};

/** A full workout session (active or completed). */
export type WorkoutSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  exercises: ExerciseEntry[];
};

/** One item inside a routine block (e.g. "Barbell bench press — 4 sets"). */
export type RoutineBlock = {
  heading: string;
  items: string[];
};

/** A training program / routine (pre-built or user-created). */
export type PersonalRoutine = {
  id: string;
  title: string;
  /** e.g. "Monday" — optional day label on cards. */
  dayLabel?: string;
  blocks: RoutineBlock[];
};
