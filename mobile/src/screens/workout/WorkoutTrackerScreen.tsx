import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { colors, spacing } from '../../theme';

type SetEntry = { id: string; reps: string; weightKg: string };
type ExerciseEntry = { id: string; name: string; sets: SetEntry[] };

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Local-only workout log: exercises → sets (reps / weight).
 * Same shape you’ll later POST to your API; only persistence is missing.
 */
export function WorkoutTrackerScreen() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

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

  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Text style={styles.title}>Workout</Text>
        <Text style={styles.sub}>
          Tap Start, add exercises, then log sets. On the web you’d use inputs the same way — here they’re native
          TextInputs.
        </Text>

        {!sessionStarted ? (
          <Card style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>Today&apos;s session</Text>
            <Text style={styles.sessionName}>Ready when you are</Text>
            <PrimaryButton label="Start workout" onPress={startWorkout} style={styles.primaryBtn} />
            <Text style={styles.microcopy}>Session lives in React state only until we add the backend.</Text>
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
                <Text style={styles.emptyBody}>Add one to start logging sets.</Text>
                <PrimaryButton label="Add exercise" onPress={openAddExercise} />
              </Card>
            ) : (
              <FlatList
                data={exercises}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: ex }) => (
                  <Card style={styles.exCard}>
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
                )}
              />
            )}
          </>
        )}
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
    marginBottom: spacing.lg,
  },
  sessionCard: {
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
  list: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  exCard: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  exNameInput: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  setInputWide: {
    flex: 1,
    minWidth: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
});
