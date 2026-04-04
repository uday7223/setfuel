import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Macros, Meal } from '../../types';
import { mealService, userService } from '../../services';
import { dashboard, spacing } from '../../theme';

const d = dashboard;

const GLASS_BG = d.glassCard;
const GLASS_BORDER = d.glassCardBorder;

export function DietTrackerScreen() {
  const insets = useSafeAreaInsets();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [mealName, setMealName] = useState('');
  const [kcalText, setKcalText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [fetchedMeals, profile] = await Promise.all([
        mealService.getMeals(),
        userService.getProfile(),
      ]);
      if (cancelled) return;
      setMeals(fetchedMeals);
      setAvatarUri(profile.avatarUri);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const total = useMemo(() => meals.reduce((s, m) => s + m.kcal, 0), [meals]);
  const totalMacros = useMemo<Macros>(
    () =>
      meals.reduce(
        (acc, m) => ({
          protein: acc.protein + (m.macros?.protein ?? 0),
          carbs: acc.carbs + (m.macros?.carbs ?? 0),
          fats: acc.fats + (m.macros?.fats ?? 0),
        }),
        { protein: 0, carbs: 0, fats: 0 },
      ),
    [meals],
  );
  const progressPct = Math.min(total / mealService.DAILY_GOAL_KCAL, 1);
  const remaining = Math.max(0, mealService.DAILY_GOAL_KCAL - total);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
    }, []),
  );

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

  const closeModal = useCallback(() => setModalOpen(false), []);

  const saveMeal = useCallback(async () => {
    const name = mealName.trim() || 'Meal';
    const kcal = Math.max(0, Math.round(parseFloat(kcalText.replace(',', '.')) || 0));
    if (!Number.isFinite(kcal) || kcalText.trim() === '') return;
    const created = await mealService.addMeal({ name, kcal });
    setMeals((prev) => [created, ...prev]);
    setModalOpen(false);
  }, [mealName, kcalText]);

  const handleRemoveMeal = useCallback(async (id: string) => {
    await mealService.removeMeal(id);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const kcalValid = kcalText.trim() !== '' && Number.isFinite(parseFloat(kcalText.replace(',', '.')));

  /* ── Header chrome (dark with blur) ─────────────────── */
  const headerChrome = (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <View style={styles.avatarWrap}>
          {avatarUri && <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />}
        </View>
        <Text style={[styles.wordmark, { color: d.primary }]}>SetFuel</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={12}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="notifications-outline" size={24} color={d.primary} />
      </Pressable>
    </View>
  );

  /* ── Meal row renderer ──────────────────────────────── */
  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => (
      <View style={styles.mealCard}>
        <View style={styles.mealCardInner}>
          {item.imageUri ? (
            <View style={styles.mealThumbWrap}>
              <Image source={{ uri: item.imageUri }} style={styles.mealThumb} resizeMode="cover" />
            </View>
          ) : (
            <View style={[styles.mealThumbWrap, styles.mealThumbPlaceholder]}>
              <Ionicons name="restaurant-outline" size={24} color={d.outline} />
            </View>
          )}

          <View style={styles.mealInfo}>
            <Text style={styles.mealName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.mealMeta}>
              <Text style={styles.mealKcal}>{item.kcal} kcal</Text>
              <View style={styles.metaDot} />
              <Text style={styles.mealTime}>{item.time}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => handleRemoveMeal(item.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove meal"
            style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: d.errorContainer }]}
          >
            <Ionicons name="trash-outline" size={20} color="rgba(160,180,196,0.4)" />
          </Pressable>
        </View>
      </View>
    ),
    [handleRemoveMeal],
  );

  /* ── Footer: "Remaining" placeholder card ───────────── */
  const listFooter = remaining > 0 ? (
    <View style={styles.remainingCard}>
      <View style={styles.remainingThumbWrap}>
        <Ionicons name="restaurant-outline" size={22} color={d.outlineVariant} />
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.remainingTitle}>Remaining for Dinner</Text>
        <Text style={styles.remainingKcal}>{remaining.toLocaleString()} kcal remaining</Text>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      {/* Header with blur */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={55} tint="dark" style={[styles.headerBlur, { paddingTop: insets.top }]}>
          {headerChrome}
        </BlurView>
      ) : (
        <View
          style={[styles.headerBlur, { paddingTop: insets.top, backgroundColor: `${d.background}cc` }]}
        >
          {headerChrome}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={d.primary} />
        </View>
      ) : (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xxl + 80 },
          ]}
          ListHeaderComponent={
            <>
              {/* Editorial title */}
              <Text style={styles.screenTitle}>Diet</Text>
              <Text style={styles.screenSub}>
                Fuel your performance with mindful nutrition tracking.
              </Text>

              {/* ── Daily summary glass card ─────────── */}
              <View style={styles.glassCard}>
                <View style={styles.glowOrb} />
                <Text style={styles.dailyLabel}>DAILY SUMMARY</Text>

                <View style={styles.kcalRow}>
                  <Text style={styles.kcalBig}>{total.toLocaleString()}</Text>
                  <Text style={styles.kcalUnit}>kcal</Text>
                </View>
                <Text style={styles.goalLine}>
                  of {mealService.DAILY_GOAL_KCAL.toLocaleString()} kcal goal
                </Text>

                {/* Momentum bar */}
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={[`${d.primary}cc`, d.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progressPct * 100}%` }]}
                  />
                </View>

                {/* Macros row */}
                <View style={styles.macrosRow}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroLabel}>PROTEIN</Text>
                    <Text style={styles.macroValue}>{totalMacros.protein}g</Text>
                  </View>
                  <View style={[styles.macroItem, { alignItems: 'center' }]}>
                    <Text style={styles.macroLabel}>CARBS</Text>
                    <Text style={styles.macroValue}>{totalMacros.carbs}g</Text>
                  </View>
                  <View style={[styles.macroItem, { alignItems: 'flex-end' }]}>
                    <Text style={styles.macroLabel}>FATS</Text>
                    <Text style={styles.macroValue}>{totalMacros.fats}g</Text>
                  </View>
                </View>
              </View>

              {/* ── Action buttons ────────────────────── */}
              <View style={styles.actions}>
                <Pressable
                  onPress={openLogMeal}
                  style={({ pressed }) => [styles.actionFlex, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  <LinearGradient
                    colors={[d.primary, '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="add" size={22} color="#001f2e" />
                    <Text style={styles.gradientBtnText}>Log meal</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={openQuickAdd}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <Ionicons name="flash" size={18} color={d.primary} />
                  <Text style={styles.outlineBtnText}>Quick add</Text>
                </Pressable>
              </View>

              {/* ── Section header ────────────────────── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Logged Meals</Text>
                <Text style={styles.sectionTag}>TODAY</Text>
              </View>
            </>
          }
          renderItem={renderMeal}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="nutrition-outline" size={32} color={d.outline} />
              <Text style={styles.emptyText}>
                No meals yet — tap Log meal to start tracking.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
      )}

      {/* ── Modal ─────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{quickMode ? 'Quick add' : 'Log meal'}</Text>

            <Text style={styles.inputLabel}>
              {quickMode ? 'Label (optional)' : 'What did you eat?'}
            </Text>
            <TextInput
              value={mealName}
              onChangeText={setMealName}
              placeholder={quickMode ? 'Snack' : 'e.g. Chicken salad'}
              placeholderTextColor={d.outline}
              style={styles.modalInput}
              autoFocus={!quickMode}
            />

            <Text style={styles.inputLabel}>Calories (kcal)</Text>
            <TextInput
              value={kcalText}
              onChangeText={(t) => setKcalText(t.replace(/[^\d.,]/g, ''))}
              placeholder="350"
              placeholderTextColor={d.outline}
              style={styles.modalInput}
              keyboardType="decimal-pad"
              autoFocus={quickMode}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} style={styles.modalGhostBtn}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveMeal}
                disabled={!kcalValid}
                style={[styles.modalPrimaryBtn, { opacity: kcalValid ? 1 : 0.4 }]}
              >
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: d.background,
  },
  flex: { flex: 1 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Header ────────────────────────────────────── */
  headerBlur: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: d.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(42, 58, 72, 0.3)',
  },
  avatarImg: { width: '100%', height: '100%' },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },

  /* ── List content ──────────────────────────────── */
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  /* ── Editorial header ──────────────────────────── */
  screenTitle: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 50,
    color: d.onSurface,
    marginTop: spacing.sm,
  },
  screenSub: {
    fontSize: 16,
    lineHeight: 24,
    color: d.onSurfaceVariant,
    opacity: 0.8,
    marginTop: spacing.sm + 4,
    maxWidth: '80%',
    marginBottom: spacing.lg + spacing.md,
  },

  /* ── Glass summary card ────────────────────────── */
  glassCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    padding: spacing.lg + 8,
    marginBottom: spacing.lg + spacing.sm,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(125, 211, 252, 0.08)',
  },
  dailyLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: d.secondary,
    opacity: 0.7,
    marginBottom: spacing.md,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  kcalBig: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    color: d.onSurface,
  },
  kcalUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: `${d.primary}99`,
  },
  goalLine: {
    fontSize: 14,
    fontWeight: '500',
    color: d.onSurfaceVariant,
    marginTop: spacing.xs,
  },

  /* Momentum progress bar */
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: d.surfaceContainerHighest,
    overflow: 'hidden',
    marginTop: spacing.lg + 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    shadowColor: d.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 4,
  },

  /* Macros */
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg + 4,
    paddingHorizontal: 4,
  },
  macroItem: {
    alignItems: 'flex-start',
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: d.onSurfaceVariant,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: d.onSurface,
  },

  /* ── Action buttons ────────────────────────────── */
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg + spacing.md,
  },
  actionFlex: {
    flex: 1,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    shadowColor: d.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  gradientBtnText: {
    color: '#001f2e',
    fontSize: 16,
    fontWeight: '700',
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${d.primary}33`,
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: d.primary,
  },

  /* ── Section header ────────────────────────────── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: d.onSurface,
  },
  sectionTag: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: d.primary,
  },

  /* ── Meal card (glass) ─────────────────────────── */
  mealCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mealCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mealThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: d.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  mealThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealThumb: {
    width: '100%',
    height: '100%',
  },
  mealInfo: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: d.onSurface,
    lineHeight: 22,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  mealKcal: {
    fontSize: 13,
    fontWeight: '700',
    color: d.primary,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: d.outlineVariant,
  },
  mealTime: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: d.onSurfaceVariant,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Remaining card ────────────────────────────── */
  remainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${d.outlineVariant}80`,
    padding: spacing.md,
    opacity: 0.5,
    marginBottom: spacing.md,
  },
  remainingThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: d.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${d.outlineVariant}80`,
  },
  remainingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: d.onSurfaceVariant,
  },
  remainingKcal: {
    fontSize: 13,
    fontWeight: '700',
    color: d.primary,
    letterSpacing: 0.3,
    marginTop: 4,
  },

  /* ── Empty state ───────────────────────────────── */
  emptyCard: {
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    color: d.onSurfaceVariant,
  },

  /* ── Modal ─────────────────────────────────────── */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(10,14,26,0.78)',
  },
  modalCard: {
    backgroundColor: d.surfaceContainer,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: d.onSurface,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: d.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: d.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: d.onSurface,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(17, 24, 40, 0.4)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  modalGhostBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: `${d.primary}33`,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalGhostText: {
    fontSize: 16,
    fontWeight: '600',
    color: d.primary,
  },
  modalPrimaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: d.primaryContainer,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
