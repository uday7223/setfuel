import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from '../../components/profile/ProfileModal';
import { AppHeader } from '../../components/ui/AppHeader';
import type { DashboardSummary, UserProfile } from '../../types';
import { BASE_URL, USE_LOCAL } from '../../constant';
import { userService } from '../../services';
import type { MainTabParamList } from '../../navigation/types';
import { dashboard, spacing } from '../../theme';

const CHALLENGE_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBPvNKUTcNM3A9ClmJ4urTjrrEi7uI1ofO50tB1-UFDFkxxDsoAmH8rp85tVS1Wn3i2udY-tJSbDr3Q-UL5XFReUUxJ06-WudsmCwlQGyPVja-_i-Xr-WMaVRC_b4wP-DtRck4LMIDcievuzqsP4MXbLiMTB9j67EZXv4if0Kwsiz_LtUjq0jNgi7xDuBWkWuaAi0-7UYO1KgPh78Nyuk-1AOlIkEDjwhKx5_o6ha1IibsjQOil5eIp0wwfhAcmNQ41TZ75J11BKKI';

const TIP_ROTATE_MS = 10_000;
const TIP_FADE_OUT_MS = 320;
const TIP_FADE_IN_MS = 420;

type HomeWellnessTip = {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBgToken: 'primary' | 'tertiary' | 'brand';
};

const HOME_WELLNESS_TIPS: HomeWellnessTip[] = [
  {
    title: 'Hydration',
    body: 'Drinking 500ml of water right after waking up kickstarts your metabolism by 24% for the next 90 minutes.',
    icon: 'water-outline',
    iconBgToken: 'tertiary',
  },
  {
    title: 'Protein timing',
    body: 'A palm-sized portion of protein within an hour post-workout helps repair muscle without needing perfect timing every day.',
    icon: 'nutrition-outline',
    iconBgToken: 'tertiary',
  },
  {
    title: 'Sleep & strength',
    body: 'Even one short night of sleep can blunt heavy-lift performance—prioritize 7+ hours when you are training hard.',
    icon: 'moon-outline',
    iconBgToken: 'primary',
  },
  {
    title: 'Warm-up',
    body: 'Two minutes of easy movement before your first heavy set reduces injury risk more than static stretching alone.',
    icon: 'flash-outline',
    iconBgToken: 'brand',
  },
  {
    title: 'Steps between sets',
    body: 'Light walking between sets keeps blood flowing and can make long sessions feel easier without adding junk volume.',
    icon: 'walk-outline',
    iconBgToken: 'tertiary',
  },
  {
    title: 'Fiber first',
    body: 'Vegetables or fruit before a big meal can steady blood sugar and make afternoon energy dips less likely.',
    icon: 'leaf-outline',
    iconBgToken: 'tertiary',
  },
];

export function HomeScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const insets = useSafeAreaInsets();
  const d = dashboard;

  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const tipOpacity = useSharedValue(1);
  const tipTranslateY = useSharedValue(0);
  const skipTipEnterAnim = useRef(true);
  const loadRequestIdRef = useRef(0);

  const tipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tipOpacity.value,
    transform: [{ translateY: tipTranslateY.value }],
  }));

  const bumpTipIndex = useCallback(() => {
    setTipIndex((i) => (i + 1) % HOME_WELLNESS_TIPS.length);
  }, []);

  const playTipExit = useCallback(() => {
    tipOpacity.value = withTiming(0, { duration: TIP_FADE_OUT_MS }, (finished) => {
      if (finished) {
        runOnJS(bumpTipIndex)();
      }
    });
    tipTranslateY.value = withTiming(-10, { duration: TIP_FADE_OUT_MS });
  }, [bumpTipIndex, tipOpacity, tipTranslateY]);

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(playTipExit, TIP_ROTATE_MS);
      return () => clearInterval(id);
    }, [playTipExit]),
  );

  useEffect(() => {
    if (skipTipEnterAnim.current) {
      skipTipEnterAnim.current = false;
      return;
    }
    tipTranslateY.value = 14;
    tipOpacity.value = 0;
    tipOpacity.value = withTiming(1, { duration: TIP_FADE_IN_MS });
    tipTranslateY.value = withTiming(0, { duration: TIP_FADE_IN_MS });
  }, [tipIndex, tipOpacity, tipTranslateY]);

  const loadHomeData = useCallback(
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
            'API mode is on but EXPO_PUBLIC_API_BASE_URL is empty. Set it in mobile/.env (include /v1, e.g. http://192.168.1.5:3001/v1). On Android emulator use 10.0.2.2 instead of localhost.',
          );
        }
        const [p, s] = await Promise.all([
          userService.getProfile(),
          userService.getDashboardSummary(),
        ]);
        if (requestId !== loadRequestIdRef.current) return;
        setProfile(p);
        setAvatarUri(p.avatarUri);
        setSummary(s);
      } catch (e) {
        if (requestId !== loadRequestIdRef.current) return;
        const err = e as Error & { status?: number };
        const hint = err.message ?? 'Could not load dashboard';
        const suffix = typeof err.status === 'number' ? ` (HTTP ${err.status})` : '';
        setLoadError(`${hint}${suffix}`);
        setProfile(null);
        setSummary(null);
      } finally {
        if (requestId !== loadRequestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHomeData({ showSpinner: true });
  }, [loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(d.background);
      }
    }, [d.background]),
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const tip = HOME_WELLNESS_TIPS[tipIndex]!;
  const tipIconBg =
    tip.iconBgToken === 'primary'
      ? d.primaryIconBg
      : tip.iconBgToken === 'tertiary'
        ? d.tertiaryIconBg
        : d.tabActivePill;
  const tipIconColor =
    tip.iconBgToken === 'primary' ? d.primary : tip.iconBgToken === 'tertiary' ? d.tertiary : d.tabActive;

  const openProfile = useCallback(() => {
    setProfileModalVisible(true);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileModalVisible(false);
  }, []);

  const handleSignOut = useCallback(() => {
    setProfileModalVisible(false);
    void signOut();
  }, [signOut]);

  return (
    <View style={[styles.root, { backgroundColor: d.background }]}>
      <AppHeader
        avatarUri={avatarUri}
        topInset={insets.top}
        onProfilePress={profile ? openProfile : undefined}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={d.brandTeal} />
        </View>
      ) : loadError ? (
        <View style={styles.loadErrorWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color={d.onSurfaceVariant} />
          <Text style={[styles.loadErrorTitle, { color: d.onSurface }]}>Could not load</Text>
          <Text style={[styles.loadErrorBody, { color: d.secondary }]}>{loadError}</Text>
          <Pressable
            onPress={() => void loadHomeData({ showSpinner: true })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: d.card }, pressed && { opacity: 0.9 }]}
          >
            <Text style={[styles.retryBtnLabel, { color: d.primary }]}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadHomeData({ showRefresh: true })}
            tintColor={d.primary}
            colors={[d.primary]}
            progressBackgroundColor={d.surfaceContainer}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <Text style={[styles.metaDate, { color: d.secondary }]}>{today.toUpperCase()}</Text>
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
          <Animated.View style={[styles.tipAnimatedRow, tipAnimatedStyle]}>
            <View style={[styles.tipIconWrap, { backgroundColor: tipIconBg }]}>
              <Ionicons name={tip.icon} size={22} color={tipIconColor} />
            </View>
            <View style={styles.tipCopy}>
              <Text style={[styles.tipTitle, { color: d.onSurface }]}>{tip.title}</Text>
              <Text style={[styles.tipBody, { color: d.onSurfaceVariant }]}>{tip.body}</Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
      )}

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  },
  retryBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    marginBottom: spacing.sm,
  },
  metaDate: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
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
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tipAnimatedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
