/**
 * Your training split — copy you can edit anytime.
 * Wording normalized slightly (e.g. barbell/dumbbell spelling) but exercises match your plan.
 */

import type { PersonalRoutine, RoutineBlock } from '../types';

export type { PersonalRoutine, RoutineBlock };

export const PERSONAL_ROUTINES: PersonalRoutine[] = [
  {
    id: 'chest-monday',
    title: 'Chest',
    dayLabel: 'Monday',
    blocks: [
      {
        heading: 'Exercises',
        items: [
          'Push-ups',
          'Barbell bench press (and dumbbell flat bench)',
          'Incline barbell press (and incline dumbbell press)',
          'Decline barbell press (or decline dumbbell press)',
          'Chest machine press',
          'Single-arm dumbbell bench press — both arms',
          'Double dumbbell bench press',
          'Cable chest pulldown',
        ],
      },
    ],
  },
  {
    id: 'chest-alt',
    title: 'Chest 2.0',
    dayLabel: 'Alternate day',
    blocks: [
      {
        heading: 'Exercises',
        items: [
          'Push-ups',
          'Incline push-ups',
          'Decline push-ups',
          'Barbell bench press',
          'Incline barbell press',
          'Decline barbell press',
          'Standing barbell upright row to neck',
          'Wide chest press (front)',
        ],
      },
    ],
  },
  {
    id: 'back-wed',
    title: 'Back',
    dayLabel: 'Wednesday',
    blocks: [
      {
        heading: 'Exercises',
        items: [
          'Pull-ups',
          'Seated incline chest-supported cable row — 4 sets',
          'Seated cable lat pulldown — 4 sets',
          'Seated neutral-grip (zigzag) bar row to chest',
          'Bent-over dumbbell row, each arm',
          'Bent-over barbell row',
        ],
      },
    ],
  },
  {
    id: 'shoulder-thu',
    title: 'Shoulders',
    dayLabel: 'Thursday',
    blocks: [
      {
        heading: 'Exercises',
        items: [
          'Arnold dumbbell press',
          'Shoulder machine press (overhead)',
          'Front dumbbell raise, V path — one arm at a time',
          'Lateral dumbbell raise, both arms',
          'Seated rear delt fly',
          'Shrugs',
        ],
      },
    ],
  },
  {
    id: 'arms',
    title: 'Arms',
    blocks: [
      {
        heading: 'Biceps',
        items: [
          'Dumbbell curls',
          'Straight barbell curl',
          'Zigzag (EZ) bar curl',
          'Hammer curls',
          'Seated on bench, elbows on thighs — peak curls',
        ],
      },
      {
        heading: 'Triceps',
        items: [
          'Single-arm overhead dumbbell extension — both arms',
          'Double dumbbell overhead extension',
          'Lying zigzag bar skull crushers to forehead',
          'Cable triceps pushdown',
        ],
      },
    ],
  },
  {
    id: 'legs-sat',
    title: 'Legs',
    dayLabel: 'Saturday',
    blocks: [
      {
        heading: 'Exercises',
        items: [
          'Walk 1–2 km (warm-up)',
          'Squats',
          'Lying leg curl machine',
          'Leg press',
          'Calf press (machine)',
          'Straight leg raises',
        ],
      },
    ],
  },
];

export function flattenRoutineItems(routine: PersonalRoutine): string[] {
  return routine.blocks.flatMap((b) => b.items);
}
