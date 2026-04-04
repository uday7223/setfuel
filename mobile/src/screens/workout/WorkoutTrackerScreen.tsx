import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import type { ExerciseEntry, PersonalRoutine, SetEntry } from '../../types';
import { localId } from '../../services/api';
import { PLACEHOLDER_AVATAR } from '../../services/userService';
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

type RoutineModalState = { draft: PersonalRoutine; editMode: boolean };

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
}: ProgramRoutineCardProps) {
  const g = PROGRAM_CARD_GRADIENTS[index % PROGRAM_CARD_GRADIENTS.length];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${routine.title} program`}
      style={({ pressed }) => [styles.programCardOuter, pressed && { opacity: 0.94 }]}
    >
      <View style={[styles.programCardInner, { backgroundColor: surfaceColor }]}>
        <LinearGradient
          colors={[g[0], g[1], g[2]]}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.programAccentStripe}
        />
        <View style={styles.programCardBody}>
          <View style={styles.programCardTextBlock}>
            <Text style={[styles.programDay, { color: dayColor }]}>{dayUpper}</Text>
            <Text style={[styles.programTitle, { color: titleColor }]}>{titleLine}</Text>
          </View>
          <View style={styles.programMeta}>
            <Ionicons name="time-outline" size={15} color={metaColor} />
            <Text style={[styles.programDuration, { color: metaColor }]}>{duration} min</Text>
          </View>
        </View>
      </View>
    </Pressable>
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
  const programsCarouselRef = useRef<ScrollView>(null);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [routineModal, setRoutineModal] = useState<RoutineModalState | null>(null);
  const [programs, setPrograms] = useState<PersonalRoutine[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadRoutines().then((list) => {
      if (!cancelled) setPrograms(list);
    }).finally(() => {
      if (!cancelled) setProgramsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
    }, [d.background]),
  );

  const startWorkout = useCallback(() => {
    setSessionStarted(true);
    setExercises([]);
  }, []);

  const openAddExercise = useCallback(() => {
    setNewExerciseName('');
    setExerciseModalOpen(true);
  }, []);

  const confirmAddExercise = useCallback(() => {
    const name = newExerciseName.trim() || 'Exercise';
    setExercises((prev) => [
      ...prev,
      {
        id: localId(),
        name,
        sets: [{ id: localId(), reps: '10', weightKg: '', done: false }],
      },
    ]);
    setExerciseModalOpen(false);
  }, [newExerciseName]);

  const updateExerciseName = useCallback((exerciseId: string, name: string) => {
    setExercises((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, name } : e)));
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: [...e.sets, { id: localId(), reps: '10', weightKg: '', done: false }] }
          : e,
      ),
    );
  }, []);

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
    },
    [],
  );

  const toggleSetDone = useCallback((exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, done: !s.done } : s)),
        };
      }),
    );
  }, []);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
      ),
    );
  }, []);

  const removeExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  }, []);

  const addRoutineExercisesToSession = useCallback(() => {
    if (!routineModal || !sessionStarted) return;
    const names = flattenRoutineItems(routineModal.draft).filter((n) => n.trim().length > 0);
    setExercises((prev) => [
      ...prev,
      ...names.map((name) => ({
        id: localId(),
        name,
        sets: [{ id: localId(), reps: '10', weightKg: '', done: false }],
      })),
    ]);
    setRoutineModal(null);
  }, [routineModal, sessionStarted]);

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
    const created = createBlankProgram();
    const next = [...programs, created];
    setPrograms(next);
    await saveRoutines(next);
    openRoutineModal(created, true);
  }, [programs, createBlankProgram, openRoutineModal]);

  /** Loads PERSONAL_ROUTINES from code into storage + React state (see routinesStorage). */
  const applyBundledSamplePrograms = useCallback(() => {
    resetRoutinesToDefaults()
      .then((next) => {
        setPrograms(next);
        setRoutineModal(null);
      })
      .catch(reportSampleProgramsError);
  }, []);

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
            const next = programs.filter((p) => p.id !== id);
            setPrograms(next);
            await saveRoutines(next);
            setRoutineModal(null);
          },
        },
      ],
    );
  }, [routineModal, programs]);

  const saveProgramEdits = useCallback(async () => {
    if (!routineModal?.editMode) return;
    const cleaned = sanitizeRoutine(routineModal.draft);
    const exists = programs.some((p) => p.id === cleaned.id);
    const next = exists ? programs.map((p) => (p.id === cleaned.id ? cleaned : p)) : [...programs, cleaned];
    setPrograms(next);
    await saveRoutines(next);
    setRoutineModal({ draft: cleaned, editMode: false });
  }, [routineModal, programs]);

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

  const openExerciseMenu = useCallback((exerciseId: string) => {
    Alert.alert('Exercise', undefined, [
      {
        text: 'Remove exercise',
        style: 'destructive',
        onPress: () => removeExercise(exerciseId),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [removeExercise]);

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      <AppHeader avatarUri={PLACEHOLDER_AVATAR} topInset={insets.top} />

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
              {!programsLoading && programs.length > 0 ? (
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
            ) : programs.length === 0 ? (
              <View style={[styles.emptyProgramsCard, { borderColor: d.outlineVariant }]}>
                <Ionicons name="albums-outline" size={40} color={d.outline} />
                <Text style={[styles.emptyProgramsTitle, { color: d.onSurface }]}>No programs yet</Text>
                <Text style={[styles.emptyProgramsBody, { color: d.onSurfaceVariant }]}>
                  Create a training split — add days, sections, and exercises. Everything stays on this device
                  until you sync with a backend.
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
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.pagePad}>
            {!sessionStarted ? (
              <Pressable
                onPress={startWorkout}
                style={({ pressed }) => [
                  styles.startSessionCard,
                  {
                    borderColor: d.outlineVariant,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={styles.startSessionTitleRow}>
                  <View style={styles.startSessionIconWrap}>
                    <Ionicons name="play-circle-outline" size={24} color={d.primary} />
                  </View>
                  <Text style={[styles.startSessionTitle, { color: d.onSurface }]}>Start workout</Text>
                </View>
                <Text style={[styles.startSessionHint, { color: d.onSurfaceVariant }]}>
                  Log sets and exercises for this session. Data stays on this device until sync ships.
                </Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.activeHeader}>
                  <View style={styles.activeTitleRow}>
                    <PulseDot color={d.primary} />
                    <Text style={[styles.activeTitle, { color: d.onSurface }]}>Active session</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setSessionStarted(false);
                      setExercises([]);
                    }}
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
                              onPress={() => toggleSetDone(ex.id, s.id)}
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
                                onPress={() => removeSet(ex.id, s.id)}
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
                          onPress={() => addSet(ex.id)}
                          style={[styles.addSetBtn, { backgroundColor: d.surfaceContainerHighest }]}
                        >
                          <Ionicons name="add" size={18} color={d.primary} />
                          <Text style={[styles.addSetLabel, { color: d.primary }]}>ADD SET</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeExercise(ex.id)}
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
              onSubmitEditing={confirmAddExercise}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setExerciseModalOpen(false)}
                style={[styles.modalGhostBtn, { borderColor: d.outlineGhost15 }]}
              >
                <Text style={[styles.modalGhostText, { color: d.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmAddExercise}
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
            style={[styles.routineModalShell, { backgroundColor: d.surfaceContainerLowest }]}
            onPress={(e) => e.stopPropagation()}
          >
            {routineModal ? (
              <>
                <View style={styles.routineModalTopRow}>
                  <Text style={[styles.routineModalTitle, { color: d.onSurface, flex: 1 }]}>
                    {routineModal.editMode ? 'Edit program' : routineModal.draft.title}
                  </Text>
                  {!routineModal.editMode ? (
                    <Pressable
                      onPress={() => setRoutineModal((m) => (m ? { ...m, editMode: true } : null))}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Edit program"
                      style={({ pressed }) => [styles.routineEditIconBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name="create-outline" size={24} color={d.primary} />
                    </Pressable>
                  ) : null}
                </View>
                {!routineModal.editMode && routineModal.draft.dayLabel ? (
                  <Text style={[styles.routineModalDay, { color: d.primary }]}>{routineModal.draft.dayLabel}</Text>
                ) : null}

                <ScrollView
                  style={styles.routineModalScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {routineModal.editMode ? (
                    <>
                      <Text style={[styles.inputLabel, { color: d.onSurfaceVariant }]}>Program name</Text>
                      <TextInput
                        value={routineModal.draft.title}
                        onChangeText={(t) => updateDraft((prev) => ({ ...prev, title: t }))}
                        placeholder="e.g. Chest"
                        placeholderTextColor={d.outline}
                        style={[styles.modalInput, { color: d.onSurface, borderColor: d.outlineVariant }]}
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
                        style={[styles.modalInput, { color: d.onSurface, borderColor: d.outlineVariant }]}
                      />
                      {routineModal.draft.blocks.map((block, bi) => (
                        <View key={`edit-block-${bi}`} style={styles.routineBlock}>
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
                                { color: d.secondary, borderColor: d.outlineVariant },
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
                              >
                                <Ionicons name="trash-outline" size={20} color={d.error} />
                              </Pressable>
                            ) : null}
                          </View>
                          {block.items.map((item, ii) => (
                            <View key={`edit-item-${bi}-${ii}`} style={styles.routineEditItemRow}>
                              <Text style={[styles.routineItemIndex, { color: d.outline }]}>{ii + 1}.</Text>
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
                                >
                                  <Ionicons name="close-circle-outline" size={22} color={d.outline} />
                                </Pressable>
                              ) : (
                                <View style={{ width: 22 }} />
                              )}
                            </View>
                          ))}
                          <Pressable
                            onPress={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((b, i) =>
                                  i === bi ? { ...b, items: [...b.items, ''] } : b,
                                ),
                              }))
                            }
                            style={styles.routineAddLineBtn}
                          >
                            <Ionicons name="add" size={18} color={d.primary} />
                            <Text style={[styles.routineAddLineText, { color: d.primary }]}>Add exercise line</Text>
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        onPress={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            blocks: [...prev.blocks, { heading: 'Exercises', items: [''] }],
                          }))
                        }
                        style={[styles.routineAddSectionBtn, { borderColor: d.outlineGhost15 }]}
                      >
                        <Ionicons name="albums-outline" size={18} color={d.primary} />
                        <Text style={[styles.modalGhostText, { color: d.primary }]}>Add section</Text>
                      </Pressable>
                      <View style={styles.modalActions}>
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

                {!routineModal.editMode ? (
                  <>
                    {sessionStarted ? (
                      <Pressable
                        onPress={addRoutineExercisesToSession}
                        style={[styles.routinePrimaryBtn, { backgroundColor: d.primaryContainer }]}
                      >
                        <Text style={styles.modalPrimaryText}>Add all to session</Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.routineModalHint, { color: d.onSurfaceVariant }]}>
                        Start a workout to load this list into your log.
                      </Text>
                    )}
                    <Pressable
                      onPress={() => setRoutineModal(null)}
                      style={[styles.routineCloseBtn, { borderColor: d.outlineGhost15 }]}
                    >
                      <Text style={[styles.modalGhostText, { color: d.primary }]}>Close</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  programDuration: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  routineModalShell: {
    borderRadius: 24,
    padding: spacing.lg,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  routineModalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  routineModalDay: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  routineModalScroll: {
    maxHeight: 340,
    marginBottom: spacing.md,
  },
  routineBlock: {
    marginBottom: spacing.md,
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
    marginBottom: spacing.sm,
  },
  routineModalHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.xs,
  },
  routineEditIconBtn: {
    padding: spacing.sm,
    borderRadius: 12,
  },
  routineEditBlockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routineSectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  routineEditItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routineItemEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  routineAddLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
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
    borderRadius: 14,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  routineResetLink: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  routineResetLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
