import { Router } from 'express';
import { requireUser } from '../../middleware/requireUser.js';
import { exercisesRouter } from './exercises.js';
import { historyRouter } from './history.js';
import { mealsRouter } from './meals.js';
import { programsRouter } from './programs.js';
import { sessionsRouter } from './sessions.js';
import { setsRouter } from './sets.js';
import { userRouter } from './user.js';

export const v1Router = Router();

v1Router.get('/', (_req, res) => {
  res.json({
    version: 1,
    routes: [
      'GET /user/profile',
      'GET /user/dashboard-summary',
      'GET|POST|PUT|DELETE /programs',
      'GET /sessions?from=&to=',
      'GET /sessions/:id',
      'GET /sessions/active',
      'POST /sessions',
      'GET /history/calendar?from=&to=',
      'GET /history/day?date=',
      'POST /sessions/:id/end',
      'POST /sessions/:id/exercises',
      'DELETE|PATCH /exercises/:exerciseId',
      'POST /exercises/:exerciseId/sets',
      'DELETE|PATCH /sets/:setId',
      'POST /sets/:setId/toggle',
      'GET|POST /meals',
      'DELETE /meals/:id',
      'GET /meals/daily-summary',
    ],
  });
});

v1Router.use(requireUser);
v1Router.use('/user', userRouter);
v1Router.use('/programs', programsRouter);
v1Router.use('/sessions', sessionsRouter);
v1Router.use('/history', historyRouter);
v1Router.use('/exercises', exercisesRouter);
v1Router.use('/sets', setsRouter);
v1Router.use('/meals', mealsRouter);
