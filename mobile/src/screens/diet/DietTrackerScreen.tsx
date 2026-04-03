import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { colors, spacing } from '../../theme';

type MealRow = { id: string; name: string; kcal: number; time: string };

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatNowTime() {
  const d = new Date();
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

const SEED_MEALS: MealRow[] = [
  { id: 'seed-1', name: 'Oats + berries + yogurt', kcal: 420, time: '8:10' },
  { id: 'seed-2', name: 'Chicken bowl + rice', kcal: 650, time: '13:05' },
];

export function DietTrackerScreen() {
  const [meals, setMeals] = useState<MealRow[]>(SEED_MEALS);
  const [modalOpen, setModalOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [mealName, setMealName] = useState('');
  const [kcalText, setKcalText] = useState('');

  const total = useMemo(() => meals.reduce((s, m) => s + m.kcal, 0), [meals]);

  const openLogMeal = useCallback(() => {
    setQuickMode(false);
    setMealName('');
    setKcalText('');
    setModalOpen(true);
  }, []);

  const openQuickAdd = useCallback(() => {
    setQuickMode(true);
    setMealName('Snack');
    setKcalText('');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const saveMeal = useCallback(() => {
    const name = mealName.trim() || 'Meal';
    const kcal = Math.max(0, Math.round(parseFloat(kcalText.replace(',', '.')) || 0));
    if (!Number.isFinite(kcal) || kcalText.trim() === '') {
      return;
    }
    setMeals((prev) => [
      { id: makeId(), name, kcal, time: formatNowTime() },
      ...prev,
    ]);
    setModalOpen(false);
  }, [mealName, kcalText]);

  const removeMeal = useCallback((id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const kcalValid = kcalText.trim() !== '' && Number.isFinite(parseFloat(kcalText.replace(',', '.')));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Text style={styles.title}>Diet</Text>
        <Text style={styles.sub}>
          Log meals on the device; totals update instantly. Same pattern as web controlled inputs + submit.
        </Text>

        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>Today</Text>
          <Text style={styles.summaryKcal}>{total} kcal</Text>
          <Text style={styles.summaryHint}>Goal placeholder: 2,200 kcal</Text>
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Log meal" onPress={openLogMeal} style={styles.flexBtn} />
          <PrimaryButton label="Quick add" variant="outline" onPress={openQuickAdd} style={styles.flexBtn} />
        </View>

        <Text style={styles.section}>Logged meals</Text>
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.listEmpty}>No meals yet — tap Log meal.</Text>
          }
          renderItem={({ item }) => (
            <Card style={styles.mealRow}>
              <View style={styles.mealTop}>
                <Text style={styles.mealName}>{item.name}</Text>
                <View style={styles.mealRight}>
                  <Text style={styles.mealKcal}>{item.kcal} kcal</Text>
                  <Pressable
                    onPress={() => removeMeal(item.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Remove meal"
                  >
                    <Text style={styles.mealRemove}>✕</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.mealTime}>{item.time}</Text>
            </Card>
          )}
        />
      </KeyboardAvoidingView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{quickMode ? 'Quick add' : 'Log meal'}</Text>
            {!quickMode && (
              <TextField
                label="What did you eat?"
                value={mealName}
                onChangeText={setMealName}
                placeholder="e.g. Chicken salad"
                autoFocus={!quickMode}
              />
            )}
            {quickMode && (
              <TextField
                label="Label (optional)"
                value={mealName}
                onChangeText={setMealName}
                placeholder="Snack"
              />
            )}
            <TextField
              label="Calories (kcal)"
              value={kcalText}
              onChangeText={(t) => setKcalText(t.replace(/[^\d.,]/g, ''))}
              placeholder="350"
              keyboardType="decimal-pad"
              autoFocus={quickMode}
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" variant="outline" onPress={closeModal} style={styles.modalBtn} />
              <PrimaryButton
                label="Save"
                onPress={saveMeal}
                disabled={!kcalValid}
                style={styles.modalBtn}
              />
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
  summary: {
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryKcal: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.tertiary,
    marginTop: spacing.xs,
  },
  summaryHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  flexBtn: {
    flex: 1,
    minHeight: 48,
  },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  listEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  mealRow: {
    marginBottom: spacing.sm,
  },
  mealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  mealName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  mealRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealKcal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.tertiary,
  },
  mealRemove: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  mealTime: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
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
});
