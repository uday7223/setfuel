import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDisplayDate, formatTimeRange } from '../../lib/dateUtils';
import type { HistoryStackParamList } from '../../navigation/types';
import { historyService } from '../../services';
import type { DayHistoryDetail, ExerciseEntry, WorkoutSessionWithStats } from '../../types';
import { dashboard, spacing } from '../../theme';

const d = dashboard;

type Route = RouteProp<HistoryStackParamList, 'HistoryDayDetail'>;
type Nav = NativeStackNavigationProp<HistoryStackParamList, 'HistoryDayDetail'>;

function SessionStatsRow({ session }: { session: WorkoutSessionWithStats }) {
  const { stats } = session;
  return (
    <View style={styles.statsRow}>
      <StatChip
        icon="time-outline"
        label={stats.durationMinutes != null ? `${stats.durationMinutes} min` : '—'}
      />
      <StatChip icon="barbell-outline" label={`${stats.exerciseCount} ex`} />
      <StatChip icon="checkmark-done-outline" label={`${stats.setsCompleted}/${stats.setCount} sets`} />
      <StatChip icon="analytics-outline" label={`${stats.volumeKg} kg·rep`} />
    </View>
  );
}

function StatChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={[styles.statChip, { backgroundColor: d.surfaceContainerLow }]}>
      <Ionicons name={icon} size={14} color={d.primary} />
      <Text style={[styles.statChipText, { color: d.onSurface }]}>{label}</Text>
    </View>
  );
}

function ExerciseReadOnly({ exercise }: { exercise: ExerciseEntry }) {
  return (
    <View style={[styles.exerciseBlock, { backgroundColor: d.surfaceContainerLow }]}>
      <Text style={[styles.exerciseName, { color: d.onSurface }]}>{exercise.name}</Text>
      {exercise.sets.map((set) => (
        <View key={set.id} style={styles.setRow}>
          <Ionicons
            name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={set.done ? d.primary : d.outline}
          />
          <Text style={[styles.setText, { color: d.secondary }]}>
            {set.reps || '—'} reps
            {set.weightKg ? ` · ${set.weightKg} kg` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SessionCard({ session, index }: { session: WorkoutSessionWithStats; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <View style={[styles.card, { backgroundColor: d.card }]}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.sessionHeader}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: d.onSurface }]}>
            Workout {index + 1}
          </Text>
          <Text style={[styles.cardMeta, { color: d.secondary }]}>
            {formatTimeRange(session.startedAt, session.endedAt)}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={d.onSurfaceVariant} />
      </Pressable>
      <SessionStatsRow session={session} />
      {expanded ? (
        <View style={styles.exerciseList}>
          {session.exercises.length === 0 ? (
            <Text style={[styles.emptyHint, { color: d.secondary }]}>No exercises logged</Text>
          ) : (
            session.exercises.map((ex) => <ExerciseReadOnly key={ex.id} exercise={ex} />)
          )}
        </View>
      ) : null}
    </View>
  );
}

export function HistoryDayDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { date } = route.params;
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<DayHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await historyService.getDayDetail(date);
      setDetail(data);
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : 'Could not load day');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      void load();
    }, [load]),
  );

  const diet = detail?.dietSummary;

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={d.onSurface} />
        </Pressable>
        <View style={styles.topBarText}>
          <Text style={[styles.topTitle, { color: d.onSurface }]} numberOfLines={1}>
            {formatDisplayDate(date)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={d.brandTeal} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: d.secondary, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => void load()} style={[styles.retryBtn, { backgroundColor: d.card }]}>
            <Text style={{ color: d.primary, fontWeight: '700' }}>RETRY</Text>
          </Pressable>
        </View>
      ) : detail ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: d.card }]}>
            <View style={styles.sectionHead}>
              <Ionicons name="nutrition-outline" size={22} color={d.brandTeal} />
              <Text style={[styles.sectionTitle, { color: d.onSurface }]}>Diet</Text>
            </View>
            {diet ? (
              <>
                <Text style={[styles.kcalBig, { color: d.onSurface }]}>
                  {diet.totalKcal.toLocaleString()}{' '}
                  <Text style={[styles.kcalGoal, { color: d.secondary }]}>
                    / {diet.goalKcal.toLocaleString()} kcal
                  </Text>
                </Text>
                <Text style={[styles.cardMeta, { color: d.secondary }]}>
                  {diet.mealsLogged} meal{diet.mealsLogged === 1 ? '' : 's'} · P {Math.round(diet.macros.protein)}g ·
                  C {Math.round(diet.macros.carbs)}g · F {Math.round(diet.macros.fats)}g
                </Text>
              </>
            ) : null}
            {detail.meals.length === 0 ? (
              <Text style={[styles.emptyHint, { color: d.secondary }]}>No meals logged</Text>
            ) : (
              detail.meals.map((m) => (
                <View key={m.id} style={styles.mealRow}>
                  <Text style={[styles.mealName, { color: d.onSurface }]}>{m.name}</Text>
                  <Text style={[styles.mealMeta, { color: d.secondary }]}>
                    {m.kcal} kcal · {m.time}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.sectionHead}>
            <Ionicons name="barbell-outline" size={22} color={d.primary} />
            <Text style={[styles.sectionTitle, { color: d.onSurface }]}>
              Workouts ({detail.sessions.length})
            </Text>
          </View>

          {detail.sessions.length === 0 ? (
            <View style={[styles.card, { backgroundColor: d.card }]}>
              <Text style={[styles.emptyHint, { color: d.secondary }]}>No workouts ended this day</Text>
            </View>
          ) : (
            detail.sessions.map((s, i) => <SessionCard key={s.id} session={s} index={i} />)
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  topBarText: { flex: 1 },
  topTitle: { fontSize: 18, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12 },
  card: { borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 13, marginTop: 2 },
  kcalBig: { fontSize: 26, fontWeight: '800', marginTop: spacing.sm },
  kcalGoal: { fontSize: 16, fontWeight: '600' },
  mealRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  mealName: { fontSize: 15, fontWeight: '600' },
  mealMeta: { fontSize: 13, marginTop: 2 },
  emptyHint: { fontSize: 14, marginTop: spacing.sm },
  sessionHeader: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statChipText: { fontSize: 12, fontWeight: '600' },
  exerciseList: { marginTop: spacing.md, gap: spacing.sm },
  exerciseBlock: { borderRadius: 12, padding: spacing.md },
  exerciseName: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  setText: { fontSize: 14 },
});
