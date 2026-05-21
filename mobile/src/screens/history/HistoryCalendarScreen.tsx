import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { USE_LOCAL } from '../../constant';
import { buildMonthGrid, endOfMonth, startOfMonth, toLocalDateString } from '../../lib/dateUtils';
import { historyService } from '../../services';
import type { HistoryCalendarDay } from '../../types';
import { dashboard, spacing } from '../../theme';
import { HistoryDayDetailPanel } from './HistoryDayDetailScreen';

const d = dashboard;
const WEEK_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_MS = 280;

export function HistoryCalendarScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [days, setDays] = useState<HistoryCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedMonthKey, setLoadedMonthKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const slideX = useSharedValue(SCREEN_WIDTH);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth],
  );

  const dayMap = useMemo(() => {
    const m = new Map<string, HistoryCalendarDay>();
    for (const row of days) m.set(row.date, row);
    return m;
  }, [days]);

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthKey = `${viewYear}-${viewMonth}`;

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = toLocalDateString(startOfMonth(viewYear, viewMonth));
      const to = toLocalDateString(endOfMonth(viewYear, viewMonth));
      const res = await historyService.getCalendar(from, to);
      setDays(res.days);
      setLoadedMonthKey(monthKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load history';
      setError(msg);
      if (loadedMonthKey !== monthKey) setDays([]);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth, monthKey, loadedMonthKey]);

  useEffect(() => {
    void loadMonth();
  }, [viewYear, viewMonth]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
    }, []),
  );

  const finishCloseDay = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const closeDay = useCallback(() => {
    slideX.value = withTiming(
      SCREEN_WIDTH,
      { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishCloseDay)();
      },
    );
  }, [finishCloseDay, slideX]);

  const openDay = useCallback(
    (date: string) => {
      setSelectedDate(date);
      slideX.value = SCREEN_WIDTH;
      slideX.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
    },
    [slideX],
  );

  useEffect(() => {
    if (!selectedDate) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDay();
      return true;
    });
    return () => sub.remove();
  }, [selectedDate, closeDay]);

  const detailSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const showFullLoader = loading && loadedMonthKey !== monthKey;

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={[styles.title, { color: d.onSurface }]}>History</Text>
        <Text style={[styles.subtitle, { color: d.secondary }]}>
          Tap a day for workouts & meals
        </Text>
      </View>

      {USE_LOCAL ? (
        <View style={styles.banner}>
          <Ionicons name="cloud-offline-outline" size={20} color={d.onSurfaceVariant} />
          <Text style={[styles.bannerText, { color: d.secondary }]}>
            History needs API mode (EXPO_PUBLIC_USE_LOCAL=false) and a signed-in account.
          </Text>
        </View>
      ) : null}

      <View style={styles.monthRow}>
        <Pressable onPress={goPrevMonth} hitSlop={12} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={24} color={d.primary} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: d.onSurface }]}>{monthLabel}</Text>
        <Pressable onPress={goNextMonth} hitSlop={12} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={24} color={d.primary} />
        </Pressable>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: d.primary }]} />
          <Text style={[styles.legendLabel, { color: d.secondary }]}>Workout</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: d.brandTeal }]} />
          <Text style={[styles.legendLabel, { color: d.secondary }]}>Diet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: d.tertiary }]} />
          <Text style={[styles.legendLabel, { color: d.secondary }]}>Both</Text>
        </View>
      </View>

      <View style={styles.weekHeaderRow}>
        {WEEK_HEADERS.map((h, i) => (
          <Text key={`${h}-${i}`} style={[styles.weekHeader, { color: d.onSurfaceVariant }]}>
            {h}
          </Text>
        ))}
      </View>

      {showFullLoader ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={d.brandTeal} />
        </View>
      ) : error && days.length === 0 ? (
        <View style={styles.loader}>
          <Text style={[styles.errorText, { color: d.secondary }]}>{error}</Text>
          <Pressable onPress={() => void loadMonth()} style={[styles.retryBtn, { backgroundColor: d.card }]}>
            <Text style={{ color: d.primary, fontWeight: '700' }}>RETRY</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!selectedDate}
        >
          {weeks.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.weekRow}>
              {week.map((cell, di) => {
                if (!cell) {
                  return <View key={`e-${wi}-${di}`} style={styles.dayCell} />;
                }
                const dateStr = toLocalDateString(cell);
                const info = dayMap.get(dateStr);
                const isToday = dateStr === toLocalDateString(today);
                const hasWorkout = info?.hasWorkout ?? false;
                const hasMeals = info?.hasMeals ?? false;

                return (
                  <Pressable
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      isToday && { borderColor: d.primary, borderWidth: 1 },
                      (hasWorkout || hasMeals) && { backgroundColor: d.card },
                    ]}
                    onPress={() => openDay(dateStr)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dateStr}${hasWorkout ? ', workout' : ''}${hasMeals ? ', meals' : ''}`}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: hasWorkout || hasMeals ? d.onSurface : d.onSurfaceVariant },
                        isToday && { color: d.primary, fontWeight: '800' },
                      ]}
                    >
                      {cell.getDate()}
                    </Text>
                    <View style={styles.dotsRow}>
                      {hasWorkout ? (
                        <View style={[styles.dot, { backgroundColor: d.primary }]} />
                      ) : null}
                      {hasMeals ? (
                        <View style={[styles.dot, { backgroundColor: d.brandTeal }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {selectedDate ? (
        <Animated.View
          style={[styles.detailOverlay, detailSlideStyle, { backgroundColor: d.background }]}
        >
          <HistoryDayDetailPanel date={selectedDate} onClose={closeDay} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { fontSize: 11, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  weekHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  weekRow: { flexDirection: 'row', paddingHorizontal: spacing.md },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    margin: 2,
  },
  dayNum: { fontSize: 15, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4, minHeight: 6 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { textAlign: 'center', marginBottom: spacing.md },
  retryBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12 },
});
