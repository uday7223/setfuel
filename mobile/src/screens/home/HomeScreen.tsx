import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../../components/ui/Card';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import type { MainTabParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';

export function HomeScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Today</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <Pressable onPress={signOut} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.headline}>Your dashboard</Text>
      <Text style={styles.sub}>
        Quick snapshot placeholders — we’ll bind real data after the Node + Postgres layer exists.
      </Text>

      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Workout</Text>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statHint}>No session logged yet</Text>
          <PrimaryButton
            label="Open workout"
            variant="outline"
            style={styles.cardBtn}
            onPress={() => navigation.navigate('Workout')}
          />
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Nutrition</Text>
          <Text style={styles.statValue}>— kcal</Text>
          <Text style={styles.statHint}>Log meals on the Diet tab</Text>
          <PrimaryButton
            label="Open diet"
            variant="outline"
            style={styles.cardBtn}
            onPress={() => navigation.navigate('Diet')}
          />
        </Card>
      </View>

      <Card style={styles.tip}>
        <Text style={styles.tipTitle}>React Native vs web React</Text>
        <Text style={styles.tipBody}>
          You still use components and hooks, but layout is flex-first (no CSS grid in core RN), and you use
          Pressable instead of button for full control. Navigation is a separate library, not the URL bar.
        </Text>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  date: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  signOut: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  headline: {
    fontSize: 24,
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
  grid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  statHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  cardBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  tip: {
    marginBottom: spacing.xl,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
});
