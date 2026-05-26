import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import type { DailySummary, Macros, Meal, UserProfile } from '../../types';
import { BASE_URL, USE_LOCAL } from '../../constant';
import { useAuth } from '../../context/AuthContext';
import { mealService, userService } from '../../services';
import { ProfileModal } from '../../components/profile/ProfileModal';
import { AppHeader } from '../../components/ui/AppHeader';
import { dashboard, spacing } from '../../theme';

const d = dashboard;

const GLASS_BG = d.glassCard;
const GLASS_BORDER = d.glassCardBorder;

const EMPTY_MACROS: Macros = { protein: 0, carbs: 0, fats: 0 };

function toLocalDateKey(dateLike: string | Date): string {
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyDailySummary(): DailySummary {
  return {
    totalKcal: 0,
    goalKcal: mealService.DAILY_GOAL_KCAL,
    macros: EMPTY_MACROS,
    mealsLogged: 0,
  };
}

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * 10) / 10);
}

function buildMealMacros(
  proteinText: string,
  carbsText: string,
  fatsText: string,
): Macros | undefined {
  const protein = parseNumericInput(proteinText);
  const carbs = parseNumericInput(carbsText);
  const fats = parseNumericInput(fatsText);
  if (protein == null && carbs == null && fats == null) return undefined;
  return {
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fats: fats ?? 0,
  };
}

export function DietTrackerScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const loadRequestIdRef = useRef(0);
  const hasFocusedOnceRef = useRef(false);
  const savingMealRef = useRef(false);
  const deletingMealIdsRef = useRef<Set<string>>(new Set());

  const [meals, setMeals] = useState<Meal[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary>(createEmptyDailySummary);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [mealName, setMealName] = useState('');
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [carbsText, setCarbsText] = useState('');
  const [fatsText, setFatsText] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);
  const [deletingMealIds, setDeletingMealIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    savingMealRef.current = savingMeal;
  }, [savingMeal]);

  useEffect(() => {
    deletingMealIdsRef.current = deletingMealIds;
  }, [deletingMealIds]);

  const loadDietData = useCallback(
    async ({
      showSpinner = false,
      showRefresh = false,
    }: {
      showSpinner?: boolean;
      showRefresh?: boolean;
    } = {}) => {
      const requestId = ++loadRequestIdRef.current;
      if (showSpinner) setLoading(true);
      if (showRefresh) setRefreshing(true);
      setLoadError(null);

      try {
        if (!USE_LOCAL && !BASE_URL.trim()) {
          throw new Error(
            'API mode is on but EXPO_PUBLIC_API_BASE_URL is empty. Set it in mobile/.env (include /v1). On Android emulator use 10.0.2.2 instead of localhost.',
          );
        }

        const [mealsResult, summaryResult, profileResult] = await Promise.allSettled([
          mealService.getMeals(),
          mealService.getDailySummary(),
          userService.getProfile(),
        ]);

        if (requestId !== loadRequestIdRef.current) return;

        if (mealsResult.status === 'rejected') {
          throw mealsResult.reason;
        }
        if (summaryResult.status === 'rejected') {
          throw summaryResult.reason;
        }

        const todayKey = toLocalDateKey(new Date());
        setMeals(mealsResult.value.filter((meal) => toLocalDateKey(meal.createdAt) === todayKey));
        setDailySummary(summaryResult.value);

        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value);
          setAvatarUri(profileResult.value.avatarUri);
        }
      } catch (e) {
        if (requestId !== loadRequestIdRef.current) return;
        const err = e as Error & { status?: number };
        const hint = err.message ?? 'Could not load meals';
        const suffix = typeof err.status === 'number' ? ` (HTTP ${err.status})` : '';
        setLoadError(`${hint}${suffix}`);
        setMeals([]);
        setDailySummary(createEmptyDailySummary());
      } finally {
        if (requestId !== loadRequestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDietData({ showSpinner: true });
  }, [loadDietData]);

  const progressPct = useMemo(() => {
    if (dailySummary.goalKcal <= 0) return 0;
    return Math.min(dailySummary.totalKcal / dailySummary.goalKcal, 1);
  }, [dailySummary.goalKcal, dailySummary.totalKcal]);
  const remaining = useMemo(
    () => Math.max(0, dailySummary.goalKcal - dailySummary.totalKcal),
    [dailySummary.goalKcal, dailySummary.totalKcal],
  );
  const hasMealsMissingMacros = useMemo(() => meals.some((meal) => !meal.macros), [meals]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
      if (hasFocusedOnceRef.current) {
        void loadDietData();
      } else {
        hasFocusedOnceRef.current = true;
      }
    }, [loadDietData]),
  );

  const openLogMeal = useCallback(() => {
    setQuickMode(false);
    setMealName('');
    setKcalText('');
    setProteinText('');
    setCarbsText('');
    setFatsText('');
    setModalOpen(true);
  }, []);

  const openQuickAdd = useCallback(() => {
    setQuickMode(true);
    setMealName('Snack');
    setKcalText('');
    setProteinText('');
    setCarbsText('');
    setFatsText('');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (!savingMealRef.current) setModalOpen(false);
  }, []);

  const openProfile = useCallback(() => setProfileModalVisible(true), []);
  const closeProfile = useCallback(() => setProfileModalVisible(false), []);
  const handleSignOut = useCallback(() => {
    setProfileModalVisible(false);
    void signOut();
  }, [signOut]);

  const saveMeal = useCallback(async () => {
    if (savingMealRef.current) return;
    const name = mealName.trim() || 'Meal';
    const kcal = Math.max(0, Math.round(parseFloat(kcalText.replace(',', '.')) || 0));
    if (!Number.isFinite(kcal) || kcalText.trim() === '') {
      const msg = 'Enter a valid calorie value before saving.';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Calories required', msg);
      return;
    }

    try {
      savingMealRef.current = true;
      setSavingMeal(true);
      const macros = buildMealMacros(proteinText, carbsText, fatsText);
      const created = await mealService.addMeal({ name, kcal, ...(macros ? { macros } : {}) });
      setMeals((prev) => [created, ...prev]);
      setDailySummary((prev) => ({
        totalKcal: prev.totalKcal + created.kcal,
        goalKcal: prev.goalKcal,
        macros: {
          protein: prev.macros.protein + (created.macros?.protein ?? 0),
          carbs: prev.macros.carbs + (created.macros?.carbs ?? 0),
          fats: prev.macros.fats + (created.macros?.fats ?? 0),
        },
        mealsLogged: prev.mealsLogged + 1,
      }));
      setModalOpen(false);
      setMealName('');
      setKcalText('');
      setProteinText('');
      setCarbsText('');
      setFatsText('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save meal';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Save meal', msg);
    } finally {
      savingMealRef.current = false;
      setSavingMeal(false);
    }
  }, [carbsText, fatsText, kcalText, mealName, proteinText]);

  const handleRemoveMeal = useCallback(async (meal: Meal) => {
    if (deletingMealIdsRef.current.has(meal.id)) return;
    const nextDeleting = new Set(deletingMealIdsRef.current);
    nextDeleting.add(meal.id);
    deletingMealIdsRef.current = nextDeleting;
    setDeletingMealIds(nextDeleting);
    try {
      await mealService.removeMeal(meal.id);
      setMeals((prev) => prev.filter((m) => m.id !== meal.id));
      setDailySummary((prev) => ({
        totalKcal: Math.max(0, prev.totalKcal - meal.kcal),
        goalKcal: prev.goalKcal,
        macros: {
          protein: Math.max(0, prev.macros.protein - (meal.macros?.protein ?? 0)),
          carbs: Math.max(0, prev.macros.carbs - (meal.macros?.carbs ?? 0)),
          fats: Math.max(0, prev.macros.fats - (meal.macros?.fats ?? 0)),
        },
        mealsLogged: Math.max(0, prev.mealsLogged - 1),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not remove meal';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Remove meal', msg);
    } finally {
      const nextDeletingIds = new Set(deletingMealIdsRef.current);
      nextDeletingIds.delete(meal.id);
      deletingMealIdsRef.current = nextDeletingIds;
      setDeletingMealIds(nextDeletingIds);
    }
  }, []);

  const confirmRemoveMeal = useCallback(
    (meal: Meal) => {
      const title = `Remove ${meal.name}?`;
      const body = 'This meal will be removed from today’s log.';
      if (Platform.OS === 'web') {
        const ok =
          typeof globalThis.confirm === 'function' && globalThis.confirm(`${title}\n\n${body}`);
        if (ok) void handleRemoveMeal(meal);
        return;
      }

      Alert.alert(title, body, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void handleRemoveMeal(meal);
          },
        },
      ]);
    },
    [handleRemoveMeal],
  );

  const kcalValid = kcalText.trim() !== '' && Number.isFinite(parseFloat(kcalText.replace(',', '.')));


  /* ── Meal row renderer ──────────────────────────────── */
  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => {
      const deleting = deletingMealIds.has(item.id);
      return (
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
              {item.macros ? (
                <Text style={styles.mealMacroLine}>
                  P {item.macros.protein}g • C {item.macros.carbs}g • F {item.macros.fats}g
                </Text>
              ) : (
                <Text style={styles.mealMacroHint}>Macros not added</Text>
              )}
            </View>

            <Pressable
              onPress={() => confirmRemoveMeal(item)}
              disabled={deleting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              accessibilityState={{ disabled: deleting, busy: deleting }}
              style={({ pressed }) => [
                styles.deleteBtn,
                deleting && styles.deleteBtnDisabled,
                pressed && !deleting && { backgroundColor: d.errorContainer },
              ]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={d.primary} />
              ) : (
                <Ionicons name="trash-outline" size={20} color="rgba(160,180,196,0.4)" />
              )}
            </Pressable>
          </View>
        </View>
      );
    },
    [confirmRemoveMeal, deletingMealIds],
  );

  /* ── Footer: "Remaining" placeholder card ───────────── */
  const listFooter = remaining > 0 ? (
    <View style={styles.remainingCard}>
      <View style={styles.remainingThumbWrap}>
        <Ionicons name="restaurant-outline" size={22} color={d.outlineVariant} />
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.remainingTitle}>Remaining today</Text>
        <Text style={styles.remainingKcal}>{remaining.toLocaleString()} kcal remaining</Text>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <AppHeader
        avatarUri={avatarUri}
        topInset={insets.top}
        onProfilePress={profile ? openProfile : undefined}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={d.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.loadErrorWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color={d.onSurfaceVariant} />
          <Text style={styles.loadErrorTitle}>Could not load</Text>
          <Text style={[styles.loadErrorBody, { color: d.onSurfaceVariant }]}>{loadError}</Text>
          <Pressable
            onPress={() => void loadDietData({ showSpinner: true })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.retryBtnLabel}>TRY AGAIN</Text>
          </Pressable>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadDietData({ showRefresh: true })}
              tintColor={d.primary}
              colors={[d.primary]}
              progressBackgroundColor={d.surfaceContainer}
            />
          }
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
                  <Text style={styles.kcalBig}>{dailySummary.totalKcal.toLocaleString()}</Text>
                  <Text style={styles.kcalUnit}>kcal</Text>
                </View>
                <Text style={styles.goalLine}>
                  of {dailySummary.goalKcal.toLocaleString()} kcal goal
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
                    <Text style={styles.macroValue}>{dailySummary.macros.protein}g</Text>
                  </View>
                  <View style={[styles.macroItem, { alignItems: 'center' }]}>
                    <Text style={styles.macroLabel}>CARBS</Text>
                    <Text style={styles.macroValue}>{dailySummary.macros.carbs}g</Text>
                  </View>
                  <View style={[styles.macroItem, { alignItems: 'flex-end' }]}>
                    <Text style={styles.macroLabel}>FATS</Text>
                    <Text style={styles.macroValue}>{dailySummary.macros.fats}g</Text>
                  </View>
                </View>
                {hasMealsMissingMacros ? (
                  <Text style={styles.macroHintLine}>
                    Macro totals include only meals with macro data.
                  </Text>
                ) : null}
              </View>

              {/* ── Action buttons ────────────────────── */}
              <View style={styles.actions}>
                <Pressable
                  onPress={openLogMeal}
                  style={({ pressed }) => [styles.actionFlex, pressed && styles.actionPressed]}
                >
                  <LinearGradient
                    colors={[d.primary, '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <View style={styles.actionBtnInner} pointerEvents="none">
                      <View style={styles.actionIconWrap}>
                        <Ionicons name="add" size={20} color="#001f2e" />
                      </View>
                      <Text style={styles.gradientBtnText}>Log meal</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={openQuickAdd}
                  style={({ pressed }) => [styles.actionFlex, pressed && styles.actionPressed]}
                >
                  <LinearGradient
                    colors={[d.primary, '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <View style={styles.actionBtnInner} pointerEvents="none">
                      <View style={styles.actionIconWrap}>
                        <Ionicons name="flash" size={20} color="#001f2e" />
                      </View>
                      <Text style={styles.gradientBtnText}>Quick add</Text>
                    </View>
                  </LinearGradient>
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
                No meals logged today yet. Tap Log meal to start tracking.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
      )}

      {/* ── Modal ─────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <Pressable style={styles.modalSheetScrim} onPress={closeModal} />
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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

              <Text style={styles.inputLabel}>Macros (optional)</Text>
              <Text style={styles.inputHint}>Leave blank if you only want to track calories.</Text>
              <View style={styles.macroInputsRow}>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Protein</Text>
                  <TextInput
                    value={proteinText}
                    onChangeText={(t) => setProteinText(t.replace(/[^\d.,]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={d.outline}
                    style={styles.modalInput}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Carbs</Text>
                  <TextInput
                    value={carbsText}
                    onChangeText={(t) => setCarbsText(t.replace(/[^\d.,]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={d.outline}
                    style={styles.modalInput}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Fats</Text>
                  <TextInput
                    value={fatsText}
                    onChangeText={(t) => setFatsText(t.replace(/[^\d.,]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={d.outline}
                    style={styles.modalInput}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} disabled={savingMeal} style={styles.modalGhostBtn}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveMeal()}
                disabled={!kcalValid || savingMeal}
                style={[styles.modalPrimaryBtn, { opacity: kcalValid && !savingMeal ? 1 : 0.4 }]}
              >
                <Text style={styles.modalPrimaryText}>
                  {savingMeal ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <ProfileModal
        visible={profileModalVisible}
        onClose={closeProfile}
        onSignOut={handleSignOut}
        profile={profile}
        bottomInset={insets.bottom}
      />
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
  loadErrorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  loadErrorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.onSurface,
    marginTop: spacing.sm,
  },
  loadErrorBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: d.card,
  },
  retryBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: d.primary,
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
  macroHintLine: {
    fontSize: 12,
    lineHeight: 18,
    color: d.onSurfaceVariant,
    opacity: 0.78,
    marginTop: spacing.md,
  },

  /* ── Action buttons ────────────────────────────── */
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    marginBottom: spacing.lg + spacing.md,
  },
  actionFlex: {
    flex: 1,
  },
  actionPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.95,
  },
  gradientBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md + spacing.xs,
    shadowColor: d.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
    maxWidth: '100%',
  },
  actionIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBtnText: {
    color: '#001f2e',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    includeFontPadding: false,
    flexShrink: 0,
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
  mealMacroLine: {
    fontSize: 12,
    fontWeight: '600',
    color: d.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  mealMacroHint: {
    fontSize: 12,
    color: d.outlineVariant,
    marginTop: spacing.xs,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.7,
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10,14,26,0.78)',
  },
  modalSheetScrim: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: d.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: d.outlineGhost15,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalScrollContent: {
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: d.onSurface,
    marginBottom: spacing.md,
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
  inputHint: {
    fontSize: 12,
    lineHeight: 18,
    color: d.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroInputCol: {
    flex: 1,
  },
  macroInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: d.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    marginTop: spacing.md,
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
