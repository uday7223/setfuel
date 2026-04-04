import React, { useCallback } from 'react';
import {
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { authLanding, dashboard, spacing } from '../../theme';

const FOOTER_IMAGE_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBqfhiQhiouDWmesT_ISXjf0SoAhHr5PDUZaGU-XErRgDPX2gXZgneo8HDx2XzS5PSjhO0ixvab7KU1_nRsIkR-JzR_zx7EPYeL6rMiC5CRTb128j60XpecWpxZIYnTffSt_NrfbghTGs7onILgZHYpR3ZR1p_DkBXhJ4IeO8poPc0T1nBeLQ9HcAh5Ohva-h_kR17X_PJ5AKTyDXiA9D6NyRynhCxO-3Hkgt-9vMmoxpkNEaB2iSxZL2lg2wgt3cEhKMPBG_XB7g0';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/**
 * Dark landing / auth screen — Stitch “Mindful Kinetic” (tonal layering, editorial type).
 * Google CTA is still a placeholder until OAuth + backend.
 */
export function LoginScreen() {
  const { signInWithGooglePlaceholder } = useAuth();
  const a = authLanding;
  const d = dashboard;

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

  const cardBorder = d.outlineGhost15;
  const googleBorder = 'rgba(42, 58, 72, 0.3)';
  const badgeBg = 'rgba(26, 58, 78, 0.5)';
  const badgeLabel = '#c0d8e8';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: d.surfaceContainerLow }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={[styles.logoMark, { backgroundColor: a.accent }]}>
              <Ionicons name="flash" size={28} color={a.accentIconFg} />
            </View>
            <Text style={[styles.title, { color: a.accent }]}>SetFuel</Text>
          </View>
          <Text style={[styles.tagline, { color: d.secondary }]}>Fuel your sets, set your fuel</Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: d.surfaceContainerLowest,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.cardIntro}>
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: badgeLabel }]}>SYSTEM UPDATE</Text>
            </View>

            <Text style={[styles.headline, { color: d.onSurface }]}>Authentication Coming Soon</Text>

            <Text style={[styles.body, { color: d.onSurfaceVariant }]}>
              We&apos;re putting the finishing touches on our secure platform. Early access will be available
              shortly for all fitness enthusiasts.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            onPress={signInWithGooglePlaceholder}
            android_ripple={{ color: 'rgba(125, 211, 252, 0.12)' }}
            style={({ pressed }) => [
              styles.googleBtn,
              {
                backgroundColor: d.surfaceContainerLowest,
                borderColor: googleBorder,
              },
              Platform.OS === 'ios' && pressed && { backgroundColor: d.surfaceContainerLow },
            ]}
          >
            <View style={styles.googleBtnContent} pointerEvents="none">
              <GoogleIcon size={20} />
              <Text style={[styles.googleLabel, { color: d.onSurfaceVariant }]}>Continue with Google</Text>
            </View>
          </Pressable>

          <View style={[styles.cardFooterSection, { borderTopColor: 'rgba(42, 58, 72, 0.1)' }]}>
            <Text style={[styles.cardFooter, { color: d.outline }]}>
              PREMIUM EDITORIAL FITNESS EXPERIENCE
            </Text>
          </View>
        </View>

        <View style={[styles.footerImageWrap, { backgroundColor: d.surfaceContainerLow }]}>
          <Image
            source={{ uri: FOOTER_IMAGE_URI }}
            style={[styles.footerImage, { opacity: 0.4 }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', d.surfaceContainerLow]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.legalRow}>
          <Pressable onPress={() => openUrl('https://example.com/privacy')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: d.outline }]}>PRIVACY POLICY</Text>
          </Pressable>
          <Pressable onPress={() => openUrl('https://example.com/terms')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: d.outline }]}>TERMS OF SERVICE</Text>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.md,
    flexWrap: 'wrap',
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '500',
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 26,
    opacity: 0.85,
  },
  card: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardIntro: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: spacing.sm + 4,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.xs,
  },
  googleBtn: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  googleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooterSection: {
    width: '100%',
    borderTopWidth: 1,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  cardFooter: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3.2,
    textAlign: 'center',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  footerImageWrap: {
    marginTop: spacing.xs,
    height: 112,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  footerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legalLink: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
