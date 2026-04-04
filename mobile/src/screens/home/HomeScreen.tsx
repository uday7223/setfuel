import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import type { DashboardSummary, UserProfile } from '../../types';
import { userService } from '../../services';
import type { MainTabParamList } from '../../navigation/types';
import { dashboard, spacing } from '../../theme';

const CHALLENGE_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBPvNKUTcNM3A9ClmJ4urTjrrEi7uI1ofO50tB1-UFDFkxxDsoAmH8rp85tVS1Wn3i2udY-tJSbDr3Q-UL5XFReUUxJ06-WudsmCwlQGyPVja-_i-Xr-WMaVRC_b4wP-DtRck4LMIDcievuzqsP4MXbLiMTB9j67EZXv4if0Kwsiz_LtUjq0jNgi7xDuBWkWuaAi0-7UYO1KgPh78Nyuk-1AOlIkEDjwhKx5_o6ha1IibsjQOil5eIp0wwfhAcmNQ41TZ75J11BKKI';

export function HomeScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const insets = useSafeAreaInsets();
  const d = dashboard;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, s] = await Promise.all([
        userService.getProfile(),
        userService.getDashboardSummary(),
      ]);
      if (cancelled) return;
      setProfile(p);
      setSummary(s);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.headerSolid);
      }
      return () => {
        StatusBar.setBarStyle('dark-content');
      };
    }, [d.headerSolid]),
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const headerChrome = (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <View style={[styles.avatarWrap, { backgroundColor: d.surfaceContainerLow }]}>
          {profile?.avatarUri && (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} resizeMode="cover" />
          )}
        </View>
        <Text style={[styles.wordmark, { color: d.brandTeal }]}>SetFuel</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={12}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="notifications-outline" size={24} color={d.brandTeal} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={55} tint="light" style={[styles.headerBlur, { paddingTop: insets.top }]}>
          {headerChrome}
        </BlurView>
      ) : (
        <View style={[styles.headerBlur, { paddingTop: insets.top, backgroundColor: d.headerSolid }]}>
          {headerChrome}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={d.brandTeal} />
        </View>
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <Text style={[styles.metaDate, { color: d.secondary }]}>{today.toUpperCase()}</Text>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.signOutLabel, { color: d.error }]}>SIGN OUT</Text>
          </Pressable>
        </View>

        <Text style={[styles.heroTitle, { color: d.onSurface }]}>
          Your{'\n'}dashboard
        </Text>

        <View style={styles.bento}>
          <View style={[styles.bentoCard, { backgroundColor: d.card }]}>
            <View style={[styles.iconCircle, { backgroundColor: d.primaryIconBg }]}>
              <Ionicons name="barbell" size={28} color={d.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: d.onSurface }]}>Workout</Text>
            <Text style={[styles.cardMeta, { color: d.secondary }]}>
              LAST SESSION: {summary?.lastWorkoutDaysAgo ?? '–'} DAYS AGO
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Workout')}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={[d.primary, d.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientCta}
              >
                <Text style={styles.gradientCtaText}>OPEN WORKOUT</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>

          <View style={[styles.bentoCard, { backgroundColor: d.card }]}>
            <View style={[styles.iconCircle, { backgroundColor: d.tertiaryIconBg }]}>
              <Ionicons name="nutrition" size={28} color={d.tertiary} />
            </View>
            <Text style={[styles.cardTitle, { color: d.onSurface }]}>Nutrition</Text>
            <Text style={[styles.cardMetaNutrition, { color: d.secondary }]}>
              {(summary?.todayKcal ?? 0).toLocaleString()} KCAL TODAY
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: d.surfaceContainerHighest }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(summary?.nutritionProgress ?? 0) * 100}%`,
                    backgroundColor: d.primary,
                  },
                ]}
              />
            </View>
            <Pressable
              onPress={() => navigation.navigate('Diet')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.outlineCta,
                {
                  borderColor: d.outlineGhost15,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.outlineCtaText, { color: d.primary }]}>OPEN DIET</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.challengeWrap}>
          <Image source={{ uri: CHALLENGE_URI }} style={styles.challengeImg} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(10, 14, 26, 0.88)']}
            locations={[0.4, 1]}
            style={styles.challengeOverlay}
          >
            <Text style={[styles.challengeEyebrow, { color: d.primaryFixed }]}>UPCOMING CHALLENGE</Text>
            <Text style={styles.challengeTitle}>The 30-Day Kinetic Sprint</Text>
          </LinearGradient>
        </View>

        <View style={[styles.tipCard, { backgroundColor: d.surfaceContainerLow }]}>
          <View style={[styles.tipIconWrap, { backgroundColor: d.card }]}>
            <Ionicons name="bulb-outline" size={22} color={d.tertiary} />
          </View>
          <View style={styles.tipCopy}>
            <Text style={[styles.tipTitle, { color: d.onSurface }]}>Hydration Tip</Text>
            <Text style={[styles.tipBody, { color: d.onSurfaceVariant }]}>
              Drinking 500ml of water right after waking up kickstarts your metabolism by 24% for the next 90
              minutes.
            </Text>
          </View>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    gap: spacing.sm + 4,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  iconBtn: {
    padding: spacing.sm,
    borderRadius: 999,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg + spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  metaDate: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  signOutBtn: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
  },
  signOutLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 48,
    marginLeft: -2,
    marginBottom: spacing.sm,
  },
  bento: {
    gap: spacing.lg + spacing.sm,
  },
  bentoCard: {
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: '#171c1f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md + 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  cardMeta: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.lg,
  },
  cardMetaNutrition: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  gradientCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: 24,
  },
  gradientCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    shadowColor: '#00685f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 2,
  },
  outlineCta: {
    paddingVertical: spacing.md + 2,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  outlineCtaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  challengeWrap: {
    height: 192,
    borderRadius: 24,
    overflow: 'hidden',
  },
  challengeImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  challengeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  challengeEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  challengeTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tipIconWrap: {
    padding: spacing.sm + 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
  },
  tipBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});
