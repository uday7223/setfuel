import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { dashboard, spacing } from '../../theme';

const d = dashboard;

type AppHeaderProps = {
  avatarUri?: string;
  topInset: number;
  /** When set, tapping the avatar + wordmark opens profile (e.g. Home). */
  onProfilePress?: () => void;
};

export function AppHeader({ avatarUri, topInset, onProfilePress }: AppHeaderProps) {
  const brand = (
    <>
      <View style={styles.avatarWrap}>
        {avatarUri && (
          <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
        )}
      </View>
      <Text style={styles.wordmark}>SetFuel</Text>
    </>
  );

  const inner = (
    <View style={styles.row}>
      {onProfilePress ? (
        <Pressable
          onPress={onProfilePress}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          hitSlop={4}
          style={({ pressed }) => [styles.left, pressed && { opacity: 0.88 }]}
        >
          {brand}
        </Pressable>
      ) : (
        <View style={styles.left}>{brand}</View>
      )}
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

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={55} tint="dark" style={[styles.container, { paddingTop: topInset }]}>
        {inner}
      </BlurView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, backgroundColor: `${d.background}cc` }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
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
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: d.primary,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
});
