import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import {
  flattenRoutineItems,
  PERSONAL_ROUTINES,
  type PersonalRoutine,
} from '../../data/personalRoutines';
import { colors, spacing } from '../../theme';

type SetEntry = { id: string; reps: string; weightKg: string };
type ExerciseEntry = { id: string; name: string; sets: SetEntry[] };

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Local-only workout log: exercises → sets (reps / weight).
 * Personal routines live in `data/personalRoutines.ts` — edit there to change your split.
 */
export function WorkoutTrackerScreen() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [routineViewer, setRoutineViewer] = useState<PersonalRoutine | null>(null);

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
        id: makeId(),
        name,
        sets: [{ id: makeId(), reps: '10', weightKg: '' }],
      },
    ]);
    setExerciseModalOpen(false);
  }, [newExerciseName]);

  const updateExerciseName = useCallback((exerciseId: string, name: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, name } : e)),
    );
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: [...e.sets, { id: makeId(), reps: '10', weightKg: '' }],
            }
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
    if (!routineViewer || !sessionStarted) return;
    const names = flattenRoutineItems(routineViewer);
    setExercises((prev) => [
      ...prev,
      ...names.map((name) => ({
        id: makeId(),
        name,
        sets: [{ id: makeId(), reps: '10', weightKg: '' }],
      })),
    ]);
    setRoutineViewer(null);
  }, [routineViewer, sessionStarted]);

  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Workout</Text>
          <Text style={styles.sub}>
            Your programs are below for quick reference. Start a session, then load a full day in one tap or add
            exercises yourself.
          </Text>

          <Text style={styles.programsHeading}>Your programs</Text>
          {PERSONAL_ROUTINES.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setRoutineViewer(r)}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.routineCardPressed]}
            >
              <Card style={styles.routineCard}>
                <View style={styles.routineCardTop}>
                  <Text style={styles.routineTitle}>{r.title}</Text>
                  {r.dayLabel ? <Text style={styles.routineDay}>{r.dayLabel}</Text> : null}
                </View>
                <Text style={styles.routineMeta}>
                  {flattenRoutineItems(r).length} exercises · tap to view
                </Text>
              </Card>
            </Pressable>
          ))}

          {!sessionStarted ? (
            <Card style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>Today&apos;s session</Text>
              <Text style={styles.sessionName}>Ready when you are</Text>
              <PrimaryButton label="Start workout" onPress={startWorkout} style={styles.primaryBtn} />
              <Text style={styles.microcopy}>Session stays on the device until we add sync.</Text>
            </Card>
          ) : (
            <>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryStrong}>{exercises.length}</Text> exercises ·{' '}
                  <Text style={styles.summaryStrong}>{setCount}</Text> sets
                </Text>
                <View style={styles.summaryActions}>
                  <PrimaryButton
                    label="Add exercise"
                    variant="outline"
                    onPress={openAddExercise}
                    style={styles.summaryBtn}
                  />
                  <Pressable
                    onPress={() => {
                      setSessionStarted(false);
                      setExercises([]);
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={styles.endLink}>End session</Text>
                  </Pressable>
                </View>
              </Card>

              {exercises.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No exercises yet</Text>
                  <Text style={styles.emptyBody}>
                    Open a program above and use &quot;Add all to session&quot;, or add one by one.
                  </Text>
                  <PrimaryButton label="Add exercise" onPress={openAddExercise} />
                </Card>
              ) : (
                exercises.map((ex) => (
                  <Card key={ex.id} style={styles.exCard}>
                    <TextInput
                      value={ex.name}
                      onChangeText={(t) => updateExerciseName(ex.id, t)}
                      style={styles.exNameInput}
                      placeholder="Exercise name"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.setsLabel}>Sets</Text>
                    {ex.sets.map((s, idx) => (
                      <View key={s.id} style={styles.setRow}>
                        <Text style={styles.setIndex}>{idx + 1}</Text>
                        <TextInput
                          value={s.reps}
                          onChangeText={(t) => updateSet(ex.id, s.id, 'reps', t)}
                          style={styles.setInput}
                          keyboardType="number-pad"
                          placeholder="Reps"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          value={s.weightKg}
                          onChangeText={(t) => updateSet(ex.id, s.id, 'weightKg', t)}
                          style={styles.setInputWide}
                          keyboardType="decimal-pad"
                          placeholder="kg"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Pressable
                          onPress={() => removeSet(ex.id, s.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Remove set"
                        >
                          <Text style={styles.remove}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    <View style={styles.exFooter}>
                      <Pressable onPress={() => addSet(ex.id)} accessibilityRole="button">
                        <Text style={styles.addSet}>+ Add set</Text>
                      </Pressable>
                      <Pressable onPress={() => removeExercise(ex.id)} accessibilityRole="button">
                        <Text style={styles.removeEx}>Remove exercise</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={exerciseModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExerciseModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setExerciseModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New exercise</Text>
            <TextField
              label="Name"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder="e.g. Back squat"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmAddExercise}
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label="Cancel"
                variant="outline"
                onPress={() => setExerciseModalOpen(false)}
                style={styles.modalBtn}
              />
              <PrimaryButton label="Add" onPress={confirmAddExercise} style={styles.modalBtn} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!routineViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setRoutineViewer(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRoutineViewer(null)}>
          <Pressable style={styles.routineModalShell} onPress={(e) => e.stopPropagation()}>
            {routineViewer ? (
              <>
                <Text style={styles.routineModalTitle}>{routineViewer.title}</Text>
                {routineViewer.dayLabel ? (
                  <Text style={styles.routineModalDay}>{routineViewer.dayLabel}</Text>
                ) : null}
                <ScrollView
                  style={styles.routineModalScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {routineViewer.blocks.map((block) => (
                    <View key={block.heading} style={styles.routineBlock}>
                      <Text style={styles.routineBlockHeading}>{block.heading}</Text>
                      {block.items.map((item, i) => (
                        <View key={`${block.heading}-${i}`} style={styles.routineItemRow}>
                          <Text style={styles.routineItemIndex}>{i + 1}.</Text>
                          <Text style={styles.routineItemText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
                {sessionStarted ? (
                  <PrimaryButton
                    label="Add all to session"
                    onPress={addRoutineExercisesToSession}
                    style={styles.routineModalPrimary}
                  />
                ) : (
                  <Text style={styles.routineModalHint}>Start a workout to load this list into your log.</Text>
                )}
                <PrimaryButton
                  label="Close"
                  variant="outline"
                  onPress={() => setRoutineViewer(null)}
                  style={styles.routineModalClose}
                />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  programsHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  routineCard: {
    marginBottom: spacing.sm,
  },
  routineCardPressed: {
    opacity: 0.92,
  },
  routineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  routineDay: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'capitalize',
  },
  routineMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sessionCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  primaryBtn: {
    marginTop: spacing.sm,
  },
  microcopy: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryLine: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryStrong: {
    fontWeight: '800',
    color: colors.text,
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  endLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  exCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  exNameInput: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineGhost,
    paddingVertical: spacing.xs,
  },
  setsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setIndex: {
    width: 22,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  setInput: {
    flex: 1,
    minWidth: 64,
    borderWidth: 1,
    borderColor: colors.outlineGhost,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceContainerHighest,
  },
  setInputWide: {
    flex: 1,
    minWidth: 72,
    borderWidth: 1,
    borderColor: colors.outlineGhost,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceContainerHighest,
  },
  remove: {
    fontSize: 18,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  exFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  addSet: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  removeEx: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    minHeight: 48,
  },
  routineModalShell: {
    backgroundColor: colors.surfaceContainerLowest,
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
    color: colors.text,
  },
  routineModalDay: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
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
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
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
    color: colors.textMuted,
    width: 28,
  },
  routineItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  routineModalPrimary: {
    marginBottom: spacing.sm,
  },
  routineModalHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  routineModalClose: {
    minHeight: 48,
  },
});
