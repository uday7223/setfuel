import React, { useCallback } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { authLanding, spacing } from '../../theme';

/**
 * Dark landing / auth screen — Stitch “Mindful Kinetic” (tonal layering, editorial type).
 * Google CTA is still a placeholder until OAuth + backend.
 */
export function LoginScreen() {
  const { signInWithGooglePlaceholder } = useAuth();
  const a = authLanding;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(a.canvas);
      }
      return () => {
        StatusBar.setBarStyle('dark-content');
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor('#ffffff');
        }
      };
    }, [a.canvas]),
  );

  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: a.canvas }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={[styles.logoMark, { backgroundColor: a.accent }]}>
            <Ionicons name="flash" size={36} color={a.accentIconFg} />
          </View>
          <Text style={[styles.title, { color: a.accent }]}>SetFuel</Text>
          <Text style={[styles.tagline, { color: a.textTagline }]}>
            Fuel your sets, set your fuel
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: a.card }]}>
          <View style={[styles.badge, { backgroundColor: a.badge }]}>
            <Text style={[styles.badgeText, { color: a.textPrimary }]}>SYSTEM UPDATE</Text>
          </View>

          <Text style={[styles.headline, { color: a.textPrimary }]}>Authentication Coming Soon</Text>

          <Text style={[styles.body, { color: a.textBody }]}>
            We&apos;re putting the finishing touches on our secure platform. Early access will be available
            shortly for all fitness enthusiasts.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={signInWithGooglePlaceholder}
            style={({ pressed }) => [
              styles.googleBtn,
              {
                backgroundColor: a.googleButtonBg,
                borderColor: a.googleButtonBorder,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <FontAwesome5 name="google" size={20} color="#4285F4" brand />
            <Text style={[styles.googleLabel, { color: a.textPrimary }]}>Continue with Google</Text>
          </Pressable>

          <View style={[styles.cardDivider, { backgroundColor: a.divider }]} />

          <Text style={[styles.cardFooter, { color: a.textMuted }]}>
            PREMIUM EDITORIAL FITNESS EXPERIENCE
          </Text>
        </View>

        <View style={styles.legalRow}>
          <Pressable onPress={() => openUrl('https://example.com/privacy')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: a.textMuted }]}>PRIVACY POLICY</Text>
          </Pressable>
          <Pressable onPress={() => openUrl('https://example.com/terms')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: a.textMuted }]}>TERMS OF SERVICE</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  card: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderRadius: 24,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 100,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
  },
  googleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  cardFooter: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 16,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  legalLink: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
