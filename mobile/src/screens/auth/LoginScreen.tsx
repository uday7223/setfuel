import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';

/**
 * UI-only “Google” entry — no OAuth yet.
 * Same layout pattern you’ll keep when swapping the handler for expo-auth-session / native Google Sign-In.
 */
export function LoginScreen() {
  const { signInWithGooglePlaceholder } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>S</Text>
        </View>
        <Text style={styles.title}>SetFuel</Text>
        <Text style={styles.tagline}>Workouts and meals, one calm place.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.welcome}>Welcome back</Text>
        <Text style={styles.hint}>
          Sign in with Google when we connect auth. For now, this button simulates a successful login so you
          can explore the app shell.
        </Text>

        <PrimaryButton
          label="Continue with Google"
          variant="google"
          onPress={signInWithGooglePlaceholder}
          style={styles.googleBtn}
        />

        <View style={styles.row}>
          <View style={styles.fakeIcon}>
            <Text style={styles.fakeG}>G</Text>
          </View>
          <Text style={styles.devNote}>Google Sign-In SDK + backend token exchange — coming in a later step.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  panel: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  googleBtn: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  fakeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.googleBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeG: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  devNote: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
