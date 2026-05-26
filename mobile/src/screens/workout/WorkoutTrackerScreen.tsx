import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExerciseEntry, PersonalRoutine, SetEntry, UserProfile } from '../../types';
import { BASE_URL, USE_LOCAL } from '../../constant';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from '../../components/profile/ProfileModal';
import { localId } from '../../services/api';
import { getProfile, PLACEHOLDER_AVATAR } from '../../services/userService';
import { workoutService } from '../../services';
import { AppHeader } from '../../components/ui/AppHeader';
import { flattenRoutineItems } from '../../data/personalRoutines';
import {
  loadRoutines,
  resetRoutinesToDefaults,
  saveRoutines,
} from '../../services/routinesStorage';
import { dashboard, spacing } from '../../theme';

function reportSampleProgramsError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Please try again.';
  console.error('[SetFuel] sample programs', err);
  if (Platform.OS === 'web') {
    if (typeof globalThis.alert === 'function') {
      globalThis.alert(`Could not load sample programs.\n\n${msg}`);
    }
  } else {
    Alert.alert('Could not load sample programs', msg);
  }
}

function cloneRoutine(r: PersonalRoutine): PersonalRoutine {
  return JSON.parse(JSON.stringify(r)) as PersonalRoutine;
}

function sanitizeRoutine(r: PersonalRoutine): PersonalRoutine {
  const blocks = r.blocks
    .map((b) => ({
      heading: b.heading.trim() || 'Exercises',
      items: b.items.map((i) => i.trim()).filter(Boolean),
    }))
    .map((b) => ({ ...b, items: b.items.length ? b.items : [''] }));
  const finalBlocks = blocks.length > 0 ? blocks : [{ heading: 'Exercises', items: [''] }];
  return {
    ...r,
    title: r.title.trim() || 'Program',
    dayLabel: r.dayLabel?.trim() || undefined,
    blocks: finalBlocks,
  };
}

function getSingleLoadedProgramId(programIds: Set<string>): string | null {
  if (programIds.size !== 1) return null;
  const first = programIds.values().next();
  return first.done ? null : first.value;
}

function appendExerciseToRoutine(routine: PersonalRoutine, name: string): PersonalRoutine {
  const trimmedName = name.trim();
  if (!trimmedName) return routine;

  const blocks =
    routine.blocks.length > 0 ? routine.blocks : [{ heading: 'Exercises', items: [''] }];

  let targetBlockIndex = -1;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (blocks[i]?.items.some((item) => item.trim().length > 0)) {
      targetBlockIndex = i;
      break;
    }
  }
  if (targetBlockIndex < 0) targetBlockIndex = Math.max(0, blocks.length - 1);

  return {
    ...routine,
    blocks: blocks.map((block, index) => {
      if (index !== targetBlockIndex) return block;
      const nextItems =
        block.items.length === 1 && !block.items[0]?.trim()
          ? [trimmedName]
          : [...block.items, trimmedName];
      return { ...block, items: nextItems };
    }),
  };
}

type RoutineModalState = { draft: PersonalRoutine; editMode: boolean };
type SessionConfirmState = { mode: 'start' | 'end'; routine?: PersonalRoutine };
type LoadRoutineOptions = { quietIfNoNewExercises?: boolean };

type ProgramRoutineCardProps = {
  routine: PersonalRoutine;
  index: number;
  duration: number;
  titleLine: string;
  dayUpper: string;
  onPress: () => void;
  surfaceColor: string;
  dayColor: string;
  titleColor: string;
  metaColor: string;
  actionLabel: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionAccentColor: string;
  actionTextColor: string;
  onActionPress: () => void;
  actionDisabled?: boolean;
};

function routineDurationMin(index: number) {
  return 55 + ((index * 37) % 20);
}

/** Left-edge accent: cyan, lavender, sky — matches Stitch program cards. */
const PROGRAM_CARD_GRADIENTS: readonly [readonly [string, string, string], readonly [string, string, string], readonly [string, string, string]] = [
  ['#8ec5ff', '#38bdf8', 'rgba(56, 189, 248, 0.08)'],
  ['#e9d5ff', '#c084fc', 'rgba(192, 132, 252, 0.12)'],
  ['#7dd3fc', '#22d3ee', 'rgba(34, 211, 238, 0.08)'],
] as const;

function ProgramRoutineCard({
  routine,
  index,
  duration,
  titleLine,
  dayUpper,
  onPress,
  surfaceColor,
  dayColor,
  titleColor,
  metaColor,
  actionLabel,
  actionIcon,
  actionAccentColor,
  actionTextColor,
  onActionPress,
  actionDisabled = false,
}: ProgramRoutineCardProps) {
  const g = PROGRAM_CARD_GRADIENTS[index % PROGRAM_CARD_GRADIENTS.length];
  return (
    <View style={styles.programCardOuter}>
      <View style={[styles.programCardInner, { backgroundColor: surfaceColor }]}>
        <LinearGradient
          colors={[g[0], g[1], g[2]]}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.programAccentStripe}
        />
        <View style={styles.programCardBody}>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${routine.title} program`}
            style={({ pressed }) => [styles.programCardTapArea, pressed && { opacity: 0.94 }]}
          >
            <View style={styles.programCardTextBlock}>
              <Text style={[styles.programDay, { color: dayColor }]}>{dayUpper}</Text>
              <Text style={[styles.programTitle, { color: titleColor }]}>{titleLine}</Text>
            </View>
          </Pressable>
          <View style={styles.programCardFooter}>
            <View style={styles.programMeta}>
              <Ionicons name="time-outline" size={15} color={metaColor} />
              <Text style={[styles.programDuration, { color: metaColor }]}>{duration} min</Text>
            </View>
            <Pressable
              onPress={onActionPress}
              disabled={actionDisabled}
              accessibilityRole="button"
              accessibilityLabel={`${actionLabel} ${routine.title}`}
              style={({ pressed }) => [
                styles.programActionBtn,
                { backgroundColor: actionAccentColor },
                actionDisabled && styles.programActionBtnDisabled,
                pressed && !actionDisabled && { opacity: 0.9 },
              ]}
            >
              <View style={styles.programActionContent}>
                {actionIcon ? (
                  <View style={styles.programActionIconWrap}>
                    <Ionicons name={actionIcon} size={16} color={actionTextColor} />
                  </View>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[styles.programActionText, { color: actionTextColor }]}
                >
                  {actionLabel}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function PulseDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.pulseDot, { backgroundColor: color, opacity }]} />;
}

/**
 * Workout log — dark “Mindful Kinetic” UI aligned with Stitch HTML; state stays on-device.
 */
export function WorkoutTrackerScreen() {
  const d = dashboard;
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const programsCarouselRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [headerAvatarUri, setHeaderAvatarUri] = useState<string | undefined>();
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [routineModal, setRoutineModal] = useState<RoutineModalState | null>(null);
  const [sessionConfirm, setSessionConfirm] = useState<SessionConfirmState | null>(null);
  const [sessionConfirmBusy, setSessionConfirmBusy] = useState(false);
  /** Program IDs already bulk-added to the current active session (reset on start/end). */
  const [programsAddedToSession, setProgramsAddedToSession] = useState<Set<string>>(() => new Set());
  const [addingProgramToSession, setAddingProgramToSession] = useState(false);
  const [programs, setPrograms] = useState<PersonalRoutine[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [programsReloadKey, setProgramsReloadKey] = useState(0);
  const exercisesRef = useRef<ExerciseEntry[]>([]);
  const programsRef = useRef<PersonalRoutine[]>([]);
  const programsAddedToSessionRef = useRef<Set<string>>(new Set());
  const addingProgramToSessionRef = useRef(false);
  const apiDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isApiMode = !USE_LOCAL;

  const routineModalMaxHeight = Math.round(
    Math.min(Dimensions.get('window').height * 0.88, 720),
  );

  useEffect(() => {
    return () => {
      Object.values(apiDebounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  useEffect(() => {
    programsAddedToSessionRef.current = programsAddedToSession;
  }, [programsAddedToSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!USE_LOCAL && !BASE_URL.trim()) {
          return;
        }
        const p = await getProfile();
        if (cancelled) return;
        setProfile(p);
        setHeaderAvatarUri(p.avatarUri);
      } catch {
        if (!cancelled) {
          setProfile(null);
          setHeaderAvatarUri(undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProgramsLoading(true);
    setProgramsError(null);
    (async () => {
      try {
        if (USE_LOCAL) {
          const list = await loadRoutines();
          if (!cancelled) setPrograms(list);
        } else {
          const list = await workoutService.getPrograms();
          if (!cancelled) setPrograms(list);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e as Error & { status?: number };
          const hint = err.message ?? 'Could not load programs';
          const suffix = typeof err.status === 'number' ? ` (HTTP ${err.status})` : '';
          setProgramsError(`${hint}${suffix}`);
          setPrograms([]);
        }
      } finally {
        if (!cancelled) setProgramsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programsReloadKey]);

  /** Resume an in-progress server session after reload (API mode only). */
  useEffect(() => {
    if (USE_LOCAL) return;
    let cancelled = false;
    (async () => {
      try {
        const active = await workoutService.getActiveSession();
        if (cancelled || !active || active.endedAt) return;
        setSessionStarted(true);
        setExercises(Array.isArray(active.exercises) ? active.exercises : []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
    }, [d.background]),
  );

  const scheduleApiSync = useCallback(
    (key: string, run: () => void | Promise<void>, ms = 550) => {
      if (!isApiMode) return;
      const t = apiDebounceTimers.current;
      if (t[key]) clearTimeout(t[key]);
      t[key] = setTimeout(() => {
        void run();
        delete t[key];
      }, ms);
    },
    [isApiMode],
  );

  const resetProgramSessionState = useCallback(() => {
    const empty = new Set<string>();
    exercisesRef.current = [];
    programsAddedToSessionRef.current = empty;
    addingProgramToSessionRef.current = false;
    setExercises([]);
    setProgramsAddedToSession(empty);
    setAddingProgramToSession(false);
  }, []);

  const startWorkout = useCallback(async (): Promise<boolean> => {
    if (isApiMode) {
      try {
        await workoutService.startSession();
        setSessionStarted(true);
        resetProgramSessionState();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not start session';
        if (Platform.OS === 'web') {
          globalThis.alert?.(`Could not start workout.\n\n${msg}`);
        } else {
          Alert.alert('Could not start workout', msg);
        }
        return false;
      }
    }
    setSessionStarted(true);
    resetProgramSessionState();
    return true;
  }, [isApiMode, resetProgramSessionState]);

  const endWorkoutSession = useCallback(async (): Promise<boolean> => {
    if (isApiMode) {
      try {
        await workoutService.endSession();
      } catch {
        /* still leave the session UI */
      }
    }
    setSessionStarted(false);
    resetProgramSessionState();
    return true;
  }, [isApiMode, resetProgramSessionState]);

  const requestStartWorkout = useCallback(
    (routine?: PersonalRoutine) => {
      if (routine && flattenRoutineItems(routine).every((name) => !name.trim())) {
        const msg = 'This program has no exercises yet. Add at least one exercise before starting it.';
        if (Platform.OS === 'web') globalThis.alert?.(msg);
        else Alert.alert('Program is empty', msg);
        return;
      }
      setSessionConfirm({ mode: 'start', ...(routine ? { routine } : {}) });
    },
    [],
  );

  const requestEndWorkout = useCallback(() => {
    setSessionConfirm({ mode: 'end' });
  }, []);

  const loadRoutineIntoActiveSession = useCallback(
    async (routine: PersonalRoutine, options?: LoadRoutineOptions): Promise<boolean> => {
      if (addingProgramToSessionRef.current) return false;

      addingProgramToSessionRef.current = true;
      setAddingProgramToSession(true);

      try {
        const programId = routine.id;
        const existingNames = new Set(
          exercisesRef.current.map((e) => e.name.trim().toLowerCase()).filter(Boolean),
        );
        const names = flattenRoutineItems(routine).filter((n) => {
          const key = n.trim().toLowerCase();
          if (!key || existingNames.has(key)) return false;
          existingNames.add(key);
          return true;
        });

        if (names.length === 0) {
          if (!options?.quietIfNoNewExercises) {
            const msg =
              'This program has no new exercises to load into the workout. Add exercises to the program first.';
            if (Platform.OS === 'web') globalThis.alert?.(msg);
            else Alert.alert('Nothing to load', msg);
          }
          return false;
        }

        if (isApiMode) {
          const added: ExerciseEntry[] = [];
          for (const name of names) {
            added.push(await workoutService.addExercise(name));
          }
          setExercises((prev) => {
            const next = [...prev, ...added];
            exercisesRef.current = next;
            return next;
          });
        } else {
          setExercises((prev) => {
            const next = [
              ...prev,
              ...names.map((name) => ({
                id: localId(),
                name,
                sets: [{ id: localId(), reps: '10', weightKg: '', done: false }],
              })),
            ];
            exercisesRef.current = next;
            return next;
          });
        }

        const nextProgramsAddedToSession = new Set(programsAddedToSessionRef.current);
        nextProgramsAddedToSession.add(programId);
        programsAddedToSessionRef.current = nextProgramsAddedToSession;
        setProgramsAddedToSession(nextProgramsAddedToSession);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load program exercises';
        if (Platform.OS === 'web') globalThis.alert?.(msg);
        else Alert.alert('Load program', msg);
        return false;
      } finally {
        addingProgramToSessionRef.current = false;
        setAddingProgramToSession(false);
      }
    },
    [isApiMode],
  );

  const syncManualExerciseToLoadedProgram = useCallback(
    async (name: string) => {
      if (!sessionStarted) return;

      const loadedProgramId = getSingleLoadedProgramId(programsAddedToSessionRef.current);
      if (!loadedProgramId) return;

      const previousPrograms = programsRef.current;
      const currentProgram = previousPrograms.find((program) => program.id === loadedProgramId);
      if (!currentProgram) return;

      const updatedProgram = appendExerciseToRoutine(currentProgram, name);
      const nextPrograms = previousPrograms.map((program) =>
        program.id === loadedProgramId ? updatedProgram : program,
      );

      programsRef.current = nextPrograms;
      setPrograms(nextPrograms);
      setRoutineModal((modal) =>
        modal && modal.draft.id === loadedProgramId
          ? { ...modal, draft: appendExerciseToRoutine(modal.draft, name) }
          : modal,
      );

      try {
        if (isApiMode) {
          const saved = await workoutService.updateProgram(updatedProgram.id, {
            title: updatedProgram.title,
            dayLabel: updatedProgram.dayLabel,
            blocks: updatedProgram.blocks,
          });
          const savedPrograms = nextPrograms.map((program) =>
            program.id === saved.id ? saved : program,
          );
          programsRef.current = savedPrograms;
          setPrograms(savedPrograms);
          setRoutineModal((modal) =>
            modal && modal.draft.id === saved.id ? { ...modal, draft: cloneRoutine(saved) } : modal,
          );
          return;
        }

        await saveRoutines(nextPrograms);
      } catch (e) {
        programsRef.current = previousPrograms;
        setPrograms(previousPrograms);
        setRoutineModal((modal) => {
          if (!modal || modal.draft.id !== loadedProgramId) return modal;
          const previousProgram = previousPrograms.find((program) => program.id === loadedProgramId);
          return previousProgram ? { ...modal, draft: cloneRoutine(previousProgram) } : modal;
        });

        const msg = e instanceof Error ? e.message : 'Could not update the current program';
        if (Platform.OS === 'web') {
          globalThis.alert?.(`Exercise added to workout, but not to the program.\n\n${msg}`);
        } else {
          Alert.alert('Program update', `Exercise added to workout, but not to the program.\n\n${msg}`);
        }
      }
    },
    [isApiMode, sessionStarted],
  );

  const handleConfirmSessionAction = useCallback(async () => {
    if (!sessionConfirm || sessionConfirmBusy) return;
    setSessionConfirmBusy(true);
    try {
      if (sessionConfirm.mode === 'start') {
        const started = await startWorkout();
        if (!started) return;
        if (sessionConfirm.routine) {
          await loadRoutineIntoActiveSession(sessionConfirm.routine);
        }
        setSessionConfirm(null);
        return;
      }

      const ended = await endWorkoutSession();
      if (ended) {
        setSessionConfirm(null);
      }
    } finally {
      setSessionConfirmBusy(false);
    }
  }, [
    endWorkoutSession,
    loadRoutineIntoActiveSession,
    sessionConfirm,
    sessionConfirmBusy,
    startWorkout,
  ]);

  const openAddExercise = useCallback(() => {
    setNewExerciseName('');
    setExerciseModalOpen(true);
  }, []);

  const confirmAddExercise = useCallback(async () => {
    const name = newExerciseName.trim() || 'Exercise';
    if (isApiMode) {
      try {
        const ex = await workoutService.addExercise(name);
        setExercises((prev) => {
          const next = [...prev, ex];
          exercisesRef.current = next;
          return next;
        });
        setExerciseModalOpen(false);
        await syncManualExerciseToLoadedProgram(ex.name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not add exercise';
        if (Platform.OS === 'web') {
          globalThis.alert?.(msg);
        } else {
          Alert.alert('Add exercise', msg);
        }
      }
      return;
    }
    setExercises((prev) => {
      const next = [
        ...prev,
        {
          id: localId(),
          name,
          sets: [{ id: localId(), reps: '10', weightKg: '', done: false }],
        },
      ];
      exercisesRef.current = next;
      return next;
    });
    setExerciseModalOpen(false);
    await syncManualExerciseToLoadedProgram(name);
  }, [isApiMode, newExerciseName, syncManualExerciseToLoadedProgram]);

  const updateExerciseName = useCallback(
    (exerciseId: string, name: string) => {
      setExercises((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, name } : e)));
      scheduleApiSync(`ex-name:${exerciseId}`, () => workoutService.updateExerciseName(exerciseId, name));
    },
    [scheduleApiSync],
  );

  const addSet = useCallback(
    async (exerciseId: string) => {
      if (isApiMode) {
        try {
          const set = await workoutService.addSet(exerciseId);
          setExercises((prev) =>
            prev.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, set] } : e)),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not add set';
          if (Platform.OS === 'web') globalThis.alert?.(msg);
          else Alert.alert('Add set', msg);
        }
        return;
      }
      setExercises((prev) =>
        prev.map((e) =>
          e.id === exerciseId
            ? { ...e, sets: [...e.sets, { id: localId(), reps: '10', weightKg: '', done: false }] }
            : e,
        ),
      );
    },
    [isApiMode],
  );

  const updateSet = useCallback(
    (exerciseId: string, setId: string, field: 'reps' | 'weightKg', value: string) => {
      const next =
        field === 'reps'
          ? value.replace(/\D/g, '')
          : value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      setExercises((prev) =>
        prev.map((e) => {
          if (e.id !== exerciseId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: next } : s)),
          };
        }),
      );
      scheduleApiSync(`set:${exerciseId}:${setId}:${field}`, () =>
        workoutService.updateSet(exerciseId, setId, field, next),
      );
    },
    [scheduleApiSync],
  );

  const toggleSetDone = useCallback(
    async (exerciseId: string, setId: string) => {
      if (isApiMode) {
        try {
          const done = await workoutService.toggleSetDone(exerciseId, setId);
          setExercises((prev) =>
            prev.map((e) => {
              if (e.id !== exerciseId) return e;
              return {
                ...e,
                sets: e.sets.map((s) => (s.id === setId ? { ...s, done } : s)),
              };
            }),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not update set';
          if (Platform.OS === 'web') globalThis.alert?.(msg);
          else Alert.alert('Set', msg);
        }
        return;
      }
      setExercises((prev) =>
        prev.map((e) => {
          if (e.id !== exerciseId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => (s.id === setId ? { ...s, done: !s.done } : s)),
          };
        }),
      );
    },
    [isApiMode],
  );

  const removeSet = useCallback(
    async (exerciseId: string, setId: string) => {
      if (isApiMode) {
        try {
          await workoutService.removeSet(exerciseId, setId);
          setExercises((prev) =>
            prev.map((e) =>
              e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
            ),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not remove set';
          if (Platform.OS === 'web') globalThis.alert?.(msg);
          else Alert.alert('Remove set', msg);
        }
        return;
      }
      setExercises((prev) =>
        prev.map((e) =>
          e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
        ),
      );
    },
    [isApiMode],
  );

  const removeExercise = useCallback(
    async (exerciseId: string) => {
      if (isApiMode) {
        try {
          await workoutService.removeExercise(exerciseId);
          setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not remove exercise';
          if (Platform.OS === 'web') globalThis.alert?.(msg);
          else Alert.alert('Remove exercise', msg);
        }
        return;
      }
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    },
    [isApiMode],
  );

  const openRoutineModal = useCallback((r: PersonalRoutine, editMode = false) => {
    setRoutineModal({ draft: cloneRoutine(r), editMode });
  }, []);

  const createBlankProgram = useCallback((): PersonalRoutine => {
    return {
      id: localId(),
      title: 'New program',
      dayLabel: undefined,
      blocks: [{ heading: 'Exercises', items: [''] }],
    };
  }, []);

  const handleAddProgram = useCallback(async () => {
    if (isApiMode) {
      try {
        const blank = createBlankProgram();
        const created = await workoutService.createProgram({
          title: blank.title,
          dayLabel: blank.dayLabel,
          blocks: blank.blocks,
        });
        setPrograms((prev) => [...prev, created]);
        openRoutineModal(created, true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not create program';
        if (Platform.OS === 'web') globalThis.alert?.(msg);
        else Alert.alert('Create program', msg);
      }
      return;
    }
    const created = createBlankProgram();
    let snapshot: PersonalRoutine[] = [];
    setPrograms((prev) => {
      snapshot = [...prev, created];
      return snapshot;
    });
    await saveRoutines(snapshot);
    openRoutineModal(created, true);
  }, [createBlankProgram, openRoutineModal, isApiMode]);

  /** Loads bundled sample programs into storage (local) or API (remote). */
  const applyBundledSamplePrograms = useCallback(() => {
    if (isApiMode) {
      workoutService
        .replaceProgramsWithBundledSamples()
        .then((next) => {
          setPrograms(next);
          setRoutineModal(null);
        })
        .catch(reportSampleProgramsError);
      return;
    }
    resetRoutinesToDefaults()
      .then((next) => {
        setPrograms(next);
        setRoutineModal(null);
      })
      .catch(reportSampleProgramsError);
  }, [isApiMode]);

  /** Alert dismiss + async storage can race on native; web has no Alert implementation at all. */
  const scheduleApplyBundledSamples = useCallback(() => {
    setTimeout(() => {
      applyBundledSamplePrograms();
    }, 0);
  }, [applyBundledSamplePrograms]);

  const confirmLoadSamplePrograms = useCallback(() => {
    if (Platform.OS === 'web') {
      const ok =
        typeof globalThis.confirm === 'function' &&
        globalThis.confirm(
          'Use sample programs?\n\nThis adds the default training split from the app. You can edit or delete programs anytime.',
        );
      if (ok) scheduleApplyBundledSamples();
      return;
    }
    Alert.alert(
      'Use sample programs?',
      'This adds the default training split from the app. You can edit or delete programs anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add samples', onPress: scheduleApplyBundledSamples },
      ],
    );
  }, [scheduleApplyBundledSamples]);

  const confirmDeleteProgram = useCallback(() => {
    if (!routineModal?.editMode) return;
    const id = routineModal.draft.id;
    Alert.alert(
      'Delete this program?',
      'This removes the program from your list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isApiMode) {
              try {
                await workoutService.deleteProgram(id);
                setPrograms((prev) => prev.filter((p) => p.id !== id));
                setRoutineModal(null);
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Could not delete';
                if (Platform.OS === 'web') globalThis.alert?.(msg);
                else Alert.alert('Delete program', msg);
              }
              return;
            }
            let next: PersonalRoutine[] = [];
            setPrograms((prev) => {
              next = prev.filter((p) => p.id !== id);
              return next;
            });
            await saveRoutines(next);
            setRoutineModal(null);
          },
        },
      ],
    );
  }, [routineModal, isApiMode]);

  const saveProgramEdits = useCallback(async () => {
    if (!routineModal?.editMode) return;
    const cleaned = sanitizeRoutine(routineModal.draft);
    const shouldSyncActiveSession =
      sessionStarted && programsAddedToSessionRef.current.has(cleaned.id);
    if (isApiMode) {
      try {
        const updated = await workoutService.updateProgram(cleaned.id, {
          title: cleaned.title,
          dayLabel: cleaned.dayLabel,
          blocks: cleaned.blocks,
        });
        setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setRoutineModal({ draft: cloneRoutine(updated), editMode: false });
        if (shouldSyncActiveSession) {
          await loadRoutineIntoActiveSession(updated, { quietIfNoNewExercises: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save program';
        if (Platform.OS === 'web') globalThis.alert?.(msg);
        else Alert.alert('Save program', msg);
      }
      return;
    }
    const exists = programs.some((p) => p.id === cleaned.id);
    const next = exists ? programs.map((p) => (p.id === cleaned.id ? cleaned : p)) : [...programs, cleaned];
    setPrograms(next);
    await saveRoutines(next);
    setRoutineModal({ draft: cleaned, editMode: false });
    if (shouldSyncActiveSession) {
      await loadRoutineIntoActiveSession(cleaned, { quietIfNoNewExercises: true });
    }
  }, [routineModal, programs, isApiMode, loadRoutineIntoActiveSession, sessionStarted]);

  const cancelProgramEdit = useCallback(() => {
    setRoutineModal((m) => {
      if (!m?.editMode) return m;
      const fresh = programs.find((p) => p.id === m.draft.id);
      return fresh ? { draft: cloneRoutine(fresh), editMode: false } : null;
    });
  }, [programs]);

  const updateDraft = useCallback((updater: (d: PersonalRoutine) => PersonalRoutine) => {
    setRoutineModal((m) => (m ? { ...m, draft: updater(m.draft) } : null));
  }, []);

  /** Avoid stacking empty sections when "Add section" is tapped repeatedly. */
  const appendProgramSection = useCallback(() => {
    updateDraft((prev) => {
      const last = prev.blocks[prev.blocks.length - 1];
      if (last && last.items.every((line) => !line.trim())) {
        return prev;
      }
      const n = prev.blocks.length + 1;
      return {
        ...prev,
        blocks: [...prev.blocks, { heading: `Section ${n}`, items: [''] }],
      };
    });
  }, [updateDraft]);

  /** Avoid stacking empty exercise lines when "Add exercise line" is tapped repeatedly. */
  const appendProgramExerciseLine = useCallback(
    (blockIndex: number) => {
      updateDraft((prev) => {
        const block = prev.blocks[blockIndex];
        if (!block) return prev;
        const lastLine = block.items[block.items.length - 1];
        if (lastLine !== undefined && !lastLine.trim()) {
          return prev;
        }
        return {
          ...prev,
          blocks: prev.blocks.map((b, i) =>
            i === blockIndex ? { ...b, items: [...b.items, ''] } : b,
          ),
        };
      });
    },
    [updateDraft],
  );

  const confirmResetAllPrograms = useCallback(() => {
    if (Platform.OS === 'web') {
      const ok =
        typeof globalThis.confirm === 'function' &&
        globalThis.confirm(
          'Replace with sample programs?\n\nThis replaces your current programs with the built-in sample split. Your edits will be lost.',
        );
      if (ok) scheduleApplyBundledSamples();
      return;
    }
    Alert.alert(
      'Replace with sample programs?',
      'This replaces your current programs with the built-in sample split. Your edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: scheduleApplyBundledSamples },
      ],
    );
  }, [scheduleApplyBundledSamples]);

  const openExerciseMenu = useCallback(
    (exerciseId: string) => {
      Alert.alert('Exercise', undefined, [
        {
          text: 'Remove exercise',
          style: 'destructive',
          onPress: () => {
            void removeExercise(exerciseId);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [removeExercise],
  );

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      <AppHeader
        avatarUri={headerAvatarUri ?? PLACEHOLDER_AVATAR}
        topInset={insets.top}
        onProfilePress={profile ? () => setProfileModalVisible(true) : undefined}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xxl + 72 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pagePad}>
            <Text style={[styles.screenTitle, { color: d.onSurface }]}>Workout</Text>
            <Text style={[styles.screenSub, { color: d.onSurfaceVariant }]}>
              Push your limits today. High intensity, high reward.
            </Text>

            <View style={styles.programsHeaderRow}>
              <Text style={[styles.sectionTitle, { color: d.onSurface }]}>Your programs</Text>
              {!programsLoading && !programsError && programs.length > 0 ? (
                <View style={styles.programsHeaderActions}>
                  <Pressable
                    onPress={() => void handleAddProgram()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add program"
                  >
                    <Text style={[styles.viewAll, { color: d.primary }]}>ADD</Text>
                  </Pressable>
                  {programs.length > 1 ? (
                    <Pressable
                      onPress={() => programsCarouselRef.current?.scrollToEnd({ animated: true })}
                      hitSlop={8}
                    >
                      <Text style={[styles.viewAll, { color: d.primary }]}>VIEW ALL</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            {programsLoading ? (
              <View style={styles.programsLoading}>
                <ActivityIndicator size="small" color={d.primary} />
              </View>
            ) : programsError ? (
              <View style={[styles.programsErrorCard, { borderColor: d.outlineVariant }]}>
                <Text style={[styles.programsErrorTitle, { color: d.onSurface }]}>Programs unavailable</Text>
                <Text style={[styles.programsErrorBody, { color: d.onSurfaceVariant }]}>{programsError}</Text>
                <Pressable
                  onPress={() => {
                    setProgramsError(null);
                    setProgramsReloadKey((n) => n + 1);
                  }}
                  style={[styles.programsRetryBtn, { backgroundColor: d.primaryContainer }]}
                >
                  <Text style={styles.modalPrimaryText}>RETRY</Text>
                </Pressable>
              </View>
            ) : programs.length === 0 ? (
              <View style={[styles.emptyProgramsCard, { borderColor: d.outlineVariant }]}>
                <Ionicons name="albums-outline" size={40} color={d.outline} />
                <Text style={[styles.emptyProgramsTitle, { color: d.onSurface }]}>No programs yet</Text>
                <Text style={[styles.emptyProgramsBody, { color: d.onSurfaceVariant }]}>
                  {isApiMode
                    ? 'Create a training split — add days, sections, and exercises. Programs are saved to your account on the server.'
                    : 'Create a training split — add days, sections, and exercises. Everything stays on this device until you sync with a backend.'}
                </Text>
                <Pressable
                  onPress={() => void handleAddProgram()}
                  style={[styles.addProgramPrimaryBtn, { backgroundColor: d.primaryContainer }]}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                  <Text style={styles.modalPrimaryText}>Add program</Text>
                </Pressable>
                <Pressable onPress={confirmLoadSamplePrograms} style={styles.sampleProgramsLink}>
                  <Text style={[styles.sampleProgramsLinkText, { color: d.primary }]}>
                    Use sample programs instead
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                ref={programsCarouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.programsHContent}
                style={styles.programsHScroll}
              >
                {programs.map((r, index) => (
                  (() => {
                    const loadedInSession = programsAddedToSession.has(r.id);
                    const showEndAction = sessionStarted && loadedInSession;
                    const actionDisabled =
                      addingProgramToSession ||
                      sessionConfirmBusy ||
                      (sessionStarted && !loadedInSession);

                    return (
                      <ProgramRoutineCard
                        key={r.id}
                        routine={r}
                        index={index}
                        duration={routineDurationMin(index)}
                        dayUpper={(r.dayLabel ?? 'DAY').toUpperCase()}
                        titleLine={r.dayLabel ? `${r.title} ${r.dayLabel}` : r.title}
                        onPress={() => openRoutineModal(r, false)}
                        surfaceColor={d.programCardSurface}
                        dayColor={d.onSurfaceVariant}
                        titleColor={d.onSurface}
                        metaColor={d.primary}
                        actionLabel={showEndAction ? 'End' : 'Start'}
                        actionIcon={showEndAction ? 'stop' : 'play'}
                        actionAccentColor={showEndAction ? d.error : d.primaryContainer}
                        actionTextColor="#fff"
                        onActionPress={() =>
                          showEndAction ? requestEndWorkout() : requestStartWorkout(r)
                        }
                        actionDisabled={actionDisabled}
                      />
                    );
                  })()
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.pagePad}>
            {!sessionStarted ? (
              // programs.length === 0 ? (
                <View
                  style={[
                    styles.startSessionCard,
                    {
                      borderColor: d.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.startSessionTitleRow}>
                    <View style={styles.startSessionIconWrap}>
                      <Ionicons name="play-circle-outline" size={24} color={d.primary} />
                    </View> 
                    <Text style={[styles.startSessionTitle, { color: d.onSurface }]}>
                      Start workout
                    </Text>
                  </View>
                  <Text style={[styles.startSessionHint, { color: d.onSurfaceVariant }]}>
                    {programs.length > 0
                      ? 'Click on the Start button to start your workout.'
                      : 'Create a program above or load the sample programs, then use that card to start your workout.'}
                  </Text>
                </View>
             
            ) : (
              <>
                <View style={styles.activeHeader}>
                  <View style={styles.activeTitleRow}>
                    <PulseDot color={d.primary} />
                    <Text style={[styles.activeTitle, { color: d.onSurface }]}>Active session</Text>
                  </View>
                  <Pressable
                    onPress={requestEndWorkout}
                    style={[styles.endSessionBtn, { backgroundColor: d.error }]}
                  >
                    <Text style={[styles.endSessionLabel, { color: d.onError }]}>END SESSION</Text>
                  </Pressable>
                </View>

                {exercises.length === 0 ? (
                  <View style={[styles.emptySession, { backgroundColor: d.surfaceContainerLowest }]}>
                    <Text style={[styles.emptySessionTitle, { color: d.onSurface }]}>No exercises yet</Text>
                    <Text style={[styles.emptySessionBody, { color: d.onSurfaceVariant }]}>
                      {programs.length > 0
                        ? 'Tap a program card to add all exercises, or use Add exercise below.'
                        : 'Add a program above first, or use Add exercise below to log manually.'}
                    </Text>
                  </View>
                ) : (
                  exercises.map((ex) => (
                    <View
                      key={ex.id}
                      style={[styles.exCard, { backgroundColor: d.surfaceContainerLowest }]}
                    >
                      <View style={styles.exCardHead}>
                        <TextInput
                          value={ex.name}
                          onChangeText={(t) => updateExerciseName(ex.id, t)}
                          style={[styles.exNameInput, { color: d.onSurface }]}
                          placeholder="Exercise name"
                          placeholderTextColor={d.outline}
                        />
                        <Pressable
                          onPress={() => openExerciseMenu(ex.id)}
                          hitSlop={12}
                          accessibilityLabel="Exercise options"
                        >
                          <Ionicons name="ellipsis-vertical" size={22} color={d.outline} />
                        </Pressable>
                      </View>

                      <View style={styles.tableHead}>
                        <Text style={[styles.thSet, { color: d.outline }]}>SET</Text>
                        <Text style={[styles.thFlex, { color: d.outline }]}>KG</Text>
                        <Text style={[styles.thFlex, styles.thCenter, { color: d.outline }]}>REPS</Text>
                        <Text style={[styles.thDone, { color: d.outline }]}>DONE</Text>
                      </View>

                      {ex.sets.map((s, idx) => (
                        <View
                          key={s.id}
                          style={[styles.setRow, { backgroundColor: d.setRowBg }]}
                        >
                          <Text style={[styles.setNum, { color: d.secondary }]}>{idx + 1}</Text>
                          <TextInput
                            value={s.weightKg}
                            onChangeText={(t) => updateSet(ex.id, s.id, 'weightKg', t)}
                            style={[styles.cellInput, { color: d.onSurface }]}
                            keyboardType="decimal-pad"
                            placeholder="—"
                            placeholderTextColor={d.outline}
                          />
                          <TextInput
                            value={s.reps}
                            onChangeText={(t) => updateSet(ex.id, s.id, 'reps', t)}
                            style={[styles.cellInput, styles.cellInputCenter, { color: d.onSurface }]}
                            keyboardType="number-pad"
                            placeholder="—"
                            placeholderTextColor={d.outline}
                          />
                          <View style={styles.doneCol}>
                        <Pressable
                          onPress={() => void toggleSetDone(ex.id, s.id)}
                              style={[
                                styles.doneBtn,
                                {
                                  backgroundColor: s.done ? d.primaryContainer : d.surfaceContainerHighest,
                                },
                              ]}
                            >
                              {s.done ? (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                              ) : (
                                <View
                                  style={[
                                    styles.doneEmpty,
                                    { borderColor: d.outline },
                                  ]}
                                />
                              )}
                            </Pressable>
                            {ex.sets.length > 1 ? (
                              <Pressable
                                onPress={() => void removeSet(ex.id, s.id)}
                                hitSlop={6}
                                style={styles.removeSetBtn}
                              >
                                <Ionicons name="close" size={16} color={d.outline} />
                              </Pressable>
                            ) : (
                              <View style={styles.removeSetPlaceholder} />
                            )}
                          </View>
                        </View>
                      ))}

                      <View style={styles.exActions}>
                        <Pressable
                          onPress={() => void addSet(ex.id)}
                          style={[styles.addSetBtn, { backgroundColor: d.surfaceContainerHighest }]}
                        >
                          <Ionicons name="add" size={18} color={d.primary} />
                          <Text style={[styles.addSetLabel, { color: d.primary }]}>ADD SET</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void removeExercise(ex.id)}
                          style={[styles.trashBtn, { backgroundColor: d.surfaceContainerHighest }]}
                        >
                          <Ionicons name="trash-outline" size={20} color={d.outline} />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}

                <Pressable
                  onPress={openAddExercise}
                  style={({ pressed }) => [
                    styles.addExerciseDashed,
                    {
                      borderColor: d.outlineVariant,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={22} color={d.outline} />
                  <Text style={[styles.addExerciseLabel, { color: d.outline }]}>ADD EXERCISE</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!sessionConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sessionConfirmBusy) setSessionConfirm(null);
        }}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(10,14,26,0.72)' }]}
          onPress={() => {
            if (!sessionConfirmBusy) setSessionConfirm(null);
          }}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: d.surfaceContainerLowest }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: d.onSurface }]}>
              {sessionConfirm?.mode === 'start' ? 'Start workout?' : 'End workout?'}
            </Text>
            <Text style={[styles.sessionConfirmBody, { color: d.onSurfaceVariant }]}>
              {sessionConfirm?.mode === 'start'
                ? sessionConfirm.routine
                  ? `Start a workout from ${sessionConfirm.routine.title}? Its exercises will be loaded into the active session automatically.`
                  : 'Start a new workout session now?'
                : 'End your current workout session now? You can start another one any time.'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setSessionConfirm(null)}
                disabled={sessionConfirmBusy}
                style={[
                  styles.modalGhostBtn,
                  { borderColor: d.outlineGhost15 },
                  sessionConfirmBusy && styles.modalActionDisabled,
                ]}
              >
                <Text style={[styles.modalGhostText, { color: d.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmSessionAction()}
                disabled={sessionConfirmBusy}
                style={[
                  styles.modalPrimaryBtn,
                  {
                    backgroundColor:
                      sessionConfirm?.mode === 'start' ? d.primaryContainer : d.error,
                  },
                  sessionConfirmBusy && styles.modalActionDisabled,
                ]}
              >
                <Text style={styles.modalPrimaryText}>
                  {sessionConfirmBusy
                    ? sessionConfirm?.mode === 'start'
                      ? 'Starting...'
                      : 'Ending...'
                    : sessionConfirm?.mode === 'start'
                      ? 'Start'
                      : 'End'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={exerciseModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExerciseModalOpen(false)}
      >
        <Pressable style={[styles.modalBackdrop, { backgroundColor: 'rgba(10,14,26,0.72)' }]} onPress={() => setExerciseModalOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: d.surfaceContainerLowest }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: d.onSurface }]}>New exercise</Text>
            <Text style={[styles.inputLabel, { color: d.onSurfaceVariant }]}>Name</Text>
            <TextInput
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder="e.g. Back squat"
              placeholderTextColor={d.outline}
              style={[styles.modalInput, { color: d.onSurface, borderColor: d.outlineVariant }]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void confirmAddExercise()}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setExerciseModalOpen(false)}
                style={[styles.modalGhostBtn, { borderColor: d.outlineGhost15 }]}
              >
                <Text style={[styles.modalGhostText, { color: d.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmAddExercise()}
                style={[styles.modalPrimaryBtn, { backgroundColor: d.primaryContainer }]}
              >
                <Text style={styles.modalPrimaryText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!routineModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (routineModal?.editMode) cancelProgramEdit();
          else setRoutineModal(null);
        }}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(10,14,26,0.72)' }]}
          onPress={() => {
            if (routineModal?.editMode) cancelProgramEdit();
            else setRoutineModal(null);
          }}
        >
          <Pressable
            style={[
              styles.routineModalShell,
              {
                backgroundColor: d.surfaceContainerLowest,
                maxHeight: routineModalMaxHeight,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {routineModal ? (
              <View style={[styles.routineModalColumn, { height: routineModalMaxHeight }]}>
                <View style={styles.routineModalHeader}>
                  <View style={styles.routineModalTopRow}>
                    <Text style={[styles.routineModalTitle, { color: d.onSurface, flex: 1 }]}>
                      {routineModal.editMode ? 'Edit program' : routineModal.draft.title}
                    </Text>
                    {routineModal.editMode ? (
                      <Pressable
                        onPress={cancelProgramEdit}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Close program editor"
                        style={({ pressed }) => [
                          styles.routineEditIconBtn,
                          { backgroundColor: d.surfaceContainerHigh },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Ionicons name="close-outline" size={22} color={d.onSurfaceVariant} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setRoutineModal((m) => (m ? { ...m, editMode: true } : null))}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Edit program"
                        style={({ pressed }) => [
                          styles.routineEditIconBtn,
                          { backgroundColor: d.surfaceContainerHigh },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Ionicons name="create-outline" size={24} color={d.primary} />
                      </Pressable>
                    )}
                  </View>
                  {routineModal.editMode ? (
                    <Text style={[styles.routineModalEditorHint, { color: d.onSurfaceVariant }]}>
                      Clean up the basics first, then update sections and exercise lines below.
                    </Text>
                  ) : null}
                  {!routineModal.editMode && routineModal.draft.dayLabel ? (
                    <Text style={[styles.routineModalDay, { color: d.primary }]}>{routineModal.draft.dayLabel}</Text>
                  ) : null}
                </View>

                <ScrollView
                  style={styles.routineModalScroll}
                  contentContainerStyle={styles.routineModalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {routineModal.editMode ? (
                    <>
                      <View
                        style={[
                          styles.routineMetaCard,
                          {
                            backgroundColor: d.surface,
                            borderColor: d.outlineGhost15,
                          },
                        ]}
                      >
                        <Text style={[styles.routineMetaTitle, { color: d.onSurface }]}>Program details</Text>
                        <Text style={[styles.routineMetaBody, { color: d.onSurfaceVariant }]}>
                          These details stay visible on the program card. Keep them short and easy to scan.
                        </Text>
                        <Text style={[styles.inputLabel, { color: d.onSurfaceVariant }]}>Program name</Text>
                        <TextInput
                          value={routineModal.draft.title}
                          onChangeText={(t) => updateDraft((prev) => ({ ...prev, title: t }))}
                          placeholder="e.g. Chest"
                          placeholderTextColor={d.outline}
                          style={[styles.modalInput, styles.routineMetaInput, { color: d.onSurface, borderColor: d.outlineVariant }]}
                        />
                        <Text style={[styles.inputLabel, { color: d.onSurfaceVariant }]}>Day label (optional)</Text>
                        <TextInput
                          value={routineModal.draft.dayLabel ?? ''}
                          onChangeText={(t) =>
                            updateDraft((prev) => ({
                              ...prev,
                              dayLabel: t.trim() ? t : undefined,
                            }))
                          }
                          placeholder="e.g. Monday"
                          placeholderTextColor={d.outline}
                          style={[styles.modalInput, styles.routineMetaInput, { color: d.onSurface, borderColor: d.outlineVariant }]}
                        />
                      </View>

                      {routineModal.draft.blocks.map((block, bi) => (
                        <View
                          key={`edit-block-${bi}`}
                          style={[
                            styles.routineBlock,
                            styles.routineEditBlockCard,
                            {
                              backgroundColor: d.surface,
                              borderColor: d.outlineGhost15,
                            },
                          ]}
                        >
                          <View style={styles.routineEditBlockHead}>
                            <TextInput
                              value={block.heading}
                              onChangeText={(t) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  blocks: prev.blocks.map((b, i) => (i === bi ? { ...b, heading: t } : b)),
                                }))
                              }
                              placeholder="Section title"
                              placeholderTextColor={d.outline}
                              style={[
                                styles.routineSectionTitleInput,
                                { color: d.onSurface, borderColor: d.outlineVariant },
                              ]}
                            />
                            {routineModal.draft.blocks.length > 1 ? (
                              <Pressable
                                onPress={() =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    blocks: prev.blocks.filter((_, i) => i !== bi),
                                  }))
                                }
                                hitSlop={8}
                                accessibilityLabel="Remove section"
                                style={[styles.routineIconActionBtn, { backgroundColor: d.surfaceContainerHigh }]}
                              >
                                <Ionicons name="trash-outline" size={20} color={d.error} />
                              </Pressable>
                            ) : null}
                          </View>
                          {block.items.map((item, ii) => (
                            <View key={`edit-item-${bi}-${ii}`} style={styles.routineEditItemRow}>
                              <View
                                style={[
                                  styles.routineItemIndexBadge,
                                  {
                                    backgroundColor: d.surfaceContainerHigh,
                                    borderColor: d.outlineGhost15,
                                  },
                                ]}
                              >
                                <Text style={[styles.routineItemIndexBadgeText, { color: d.onSurfaceVariant }]}>
                                  {ii + 1}
                                </Text>
                              </View>
                              <TextInput
                                value={item}
                                onChangeText={(t) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    blocks: prev.blocks.map((b, i) => {
                                      if (i !== bi) return b;
                                      return {
                                        ...b,
                                        items: b.items.map((it, j) => (j === ii ? t : it)),
                                      };
                                    }),
                                  }))
                                }
                                placeholder="Exercise"
                                placeholderTextColor={d.outline}
                                multiline
                                textAlignVertical="top"
                                style={[
                                  styles.routineItemEditInput,
                                  { color: d.onSurface, borderColor: d.outlineVariant },
                                ]}
                              />
                              {block.items.length > 1 ? (
                                <Pressable
                                  onPress={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      blocks: prev.blocks.map((b, i) => {
                                        if (i !== bi) return b;
                                        if (b.items.length <= 1) return b;
                                        return { ...b, items: b.items.filter((_, j) => j !== ii) };
                                      }),
                                    }))
                                  }
                                  hitSlop={8}
                                  style={[styles.routineIconActionBtn, { backgroundColor: d.surfaceContainerHigh }]}
                                >
                                  <Ionicons name="close-circle-outline" size={22} color={d.outline} />
                                </Pressable>
                              ) : (
                                <View style={styles.routineIconActionPlaceholder} />
                              )}
                            </View>
                          ))}
                          <Pressable
                            onPress={() => appendProgramExerciseLine(bi)}
                            style={[
                              styles.routineAddLineBtn,
                              {
                                borderColor: d.outlineGhost15,
                                backgroundColor: d.surfaceContainerHigh,
                              },
                            ]}
                          >
                            <Ionicons name="add" size={18} color={d.primary} />
                            <Text style={[styles.routineAddLineText, { color: d.primary }]}>Add exercise line</Text>
                          </Pressable>
                        </View>
                      ))}

                      <Pressable
                        onPress={appendProgramSection}
                        style={[
                          styles.routineAddSectionBtn,
                          {
                            borderColor: d.outlineGhost15,
                            backgroundColor: d.surface,
                          },
                        ]}
                      >
                        <Ionicons name="albums-outline" size={18} color={d.primary} />
                        <Text style={[styles.modalGhostText, { color: d.primary }]}>Add section</Text>
                      </Pressable>

                      <View
                        style={[
                          styles.routineDangerZone,
                          {
                            backgroundColor: d.surface,
                            borderColor: d.outlineGhost15,
                          },
                        ]}
                      >
                        <Text style={[styles.routineDangerTitle, { color: d.onSurface }]}>Program actions</Text>
                        <Text style={[styles.routineDangerBody, { color: d.onSurfaceVariant }]}>
                          Use these only when you want to remove this program or replace everything with the sample split.
                        </Text>
                        <Pressable onPress={confirmDeleteProgram} style={styles.routineResetLink}>
                          <Text style={[styles.routineResetLinkText, { color: d.error }]}>Delete program…</Text>
                        </Pressable>
                        {programs.length > 0 ? (
                          <Pressable onPress={confirmResetAllPrograms} style={styles.routineResetLink}>
                            <Text style={[styles.routineResetLinkText, { color: d.error }]}>
                              Reset all programs to samples…
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      {routineModal.draft.blocks.map((block, bi) => (
                        <View key={`view-block-${bi}-${block.heading}`} style={styles.routineBlock}>
                          <Text style={[styles.routineBlockHeading, { color: d.secondary }]}>{block.heading}</Text>
                          {block.items.map((item, i) => (
                            <View key={`view-item-${bi}-${i}`} style={styles.routineItemRow}>
                              <Text style={[styles.routineItemIndex, { color: d.outline }]}>{i + 1}.</Text>
                              <Text style={[styles.routineItemText, { color: d.onSurface }]}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>

                <View
                  style={[
                    styles.routineModalFooter,
                    {
                      borderTopColor: d.outlineGhost15,
                      paddingBottom: Math.max(insets.bottom, spacing.md),
                    },
                  ]}
                >
                  {routineModal.editMode ? (
                    <View style={[styles.modalActions, styles.routineModalFooterActions]}>
                      <Pressable
                        onPress={cancelProgramEdit}
                        style={[styles.modalGhostBtn, { borderColor: d.outlineGhost15 }]}
                      >
                        <Text style={[styles.modalGhostText, { color: d.primary }]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void saveProgramEdits()}
                        style={[styles.modalPrimaryBtn, { backgroundColor: d.primaryContainer }]}
                      >
                        <Text style={styles.modalPrimaryText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {sessionStarted ? (
                        <Text style={[styles.routineModalHint, { color: d.onSurfaceVariant }]}>
                          {programsAddedToSession.has(routineModal.draft.id)
                            ? 'This program already loaded the exercises in your current workout.'
                            : 'Programs load automatically when you tap Start on their card before beginning a workout.'}
                        </Text>
                      ) : (
                        <Text style={[styles.routineModalHint, { color: d.onSurfaceVariant }]}>
                          Tap Start on this program card to begin a workout with these exercises already loaded.
                        </Text>
                      )}
                      <Pressable
                        onPress={() => setRoutineModal(null)}
                        style={[styles.routineCloseBtn, { borderColor: d.outlineGhost15 }]}
                      >
                        <Text style={[styles.modalGhostText, { color: d.primary }]}>Close</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <ProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onSignOut={() => {
          setProfileModalVisible(false);
          void signOut();
        }}
        profile={profile}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  pagePad: {
    paddingHorizontal: spacing.lg,
  },
  screenTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
    marginTop: spacing.sm,
  },
  screenSub: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: spacing.sm,
    maxWidth: '88%',
    marginBottom: spacing.lg + spacing.sm,
  },
  programsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  viewAll: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  programsHScroll: {
    marginBottom: spacing.lg + spacing.sm,
    marginLeft: 0,
    marginRight: 0,
    flexGrow: 0,
  },
  programsHContent: {
    paddingLeft: 0,
    paddingRight: spacing.lg,
    alignItems: 'stretch',
  },
  programCardOuter: {
    width: 216,
    minHeight: 204,
    marginRight: spacing.md,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  programCardInner: {
    flex: 1,
    minHeight: 204,
    borderRadius: 28,
    overflow: 'hidden',
  },
  programAccentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  programCardBody: {
    flex: 1,
    minHeight: 204,
    paddingTop: spacing.lg,
    paddingRight: spacing.lg,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.lg + 10,
    justifyContent: 'space-between',
  },
  programCardTapArea: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  programCardTextBlock: {
    flexShrink: 1,
  },
  programDay: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  programTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: spacing.sm,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  programMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  programCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  programDuration: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  programActionBtn: {
    minWidth: 86,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programActionBtnDisabled: {
    opacity: 0.5,
  },
  programActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 6,
  },
  programActionIconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programActionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 16,
    includeFontPadding: false,
    flexShrink: 0,
  },
  startSessionCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: spacing.xl,
  },
  startSessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  startSessionIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startSessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    includeFontPadding: false,
    flexShrink: 0,
  },
  startSessionHint: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 28 + 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  endSessionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
  },
  endSessionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  emptySession: {
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptySessionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySessionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  exCard: {
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.lg + spacing.sm,
    shadowColor: '#171c1f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  exCardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  exNameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    padding: 0,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 4,
    paddingHorizontal: spacing.xs,
  },
  thSet: {
    width: 36,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  thFlex: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  thCenter: {
    textAlign: 'center',
  },
  thDone: {
    width: 76,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'right',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  setNum: {
    width: 36,
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 4,
  },
  cellInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cellInputCenter: {
    textAlign: 'center',
  },
  doneCol: {
    width: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEmpty: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  removeSetBtn: {
    padding: 4,
  },
  removeSetPlaceholder: {
    width: 24,
  },
  exActions: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    marginTop: spacing.lg,
  },
  addSetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  addSetLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  trashBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addExerciseDashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg + 4,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: spacing.xl,
  },
  addExerciseLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  sessionConfirmBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalGhostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalGhostText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalActionDisabled: {
    opacity: 0.65,
  },
  routineModalShell: {
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  routineModalColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  routineModalHeader: {
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  routineModalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  routineModalEditorHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  routineModalDay: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: 0,
    textTransform: 'capitalize',
  },
  routineModalScroll: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.lg,
  },
  routineModalScrollContent: {
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  routineModalFooter: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  routineModalFooterActions: {
    marginTop: 0,
  },
  routineMetaCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  routineMetaTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  routineMetaBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  routineMetaInput: {
    marginBottom: spacing.md,
  },
  routineBlock: {
    marginBottom: spacing.md,
  },
  routineEditBlockCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.md,
  },
  routineBlockHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  routineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routineItemIndex: {
    fontSize: 15,
    fontWeight: '700',
    width: 28,
  },
  routineItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  routinePrimaryBtn: {
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  routineModalHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  routineCloseBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  programsLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  programsErrorCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  programsErrorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  programsErrorBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  programsRetryBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  programsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyProgramsCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: spacing.lg + 8,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyProgramsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyProgramsBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  addProgramPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg + 8,
    borderRadius: 16,
  },
  sampleProgramsLink: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  sampleProgramsLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  routineModalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  routineEditIconBtn: {
    padding: spacing.sm,
    borderRadius: 14,
  },
  routineEditBlockHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routineSectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 14,
    fontWeight: '700',
  },
  routineEditItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routineItemIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  routineItemIndexBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routineItemEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    minHeight: 54,
    lineHeight: 21,
  },
  routineIconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  routineIconActionPlaceholder: {
    width: 36,
    height: 36,
  },
  routineAddLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: 14,
  },
  routineAddLineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  routineAddSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  routineDangerZone: {
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  routineDangerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  routineDangerBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  routineResetLink: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'flex-start',
  },
  routineResetLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
