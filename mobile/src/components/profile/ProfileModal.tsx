import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '../../types';
import { dashboard, spacing } from '../../theme';

const d = dashboard;

export type ProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
  profile: UserProfile | null;
  /** When opening before profile is loaded (optional lazy fetch). */
  loading?: boolean;
  bottomInset: number;
};

export function ProfileModal({
  visible,
  onClose,
  onSignOut,
  profile,
  loading = false,
  bottomInset,
}: ProfileModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile"
          style={[StyleSheet.absoluteFillObject, styles.backdrop]}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: d.surfaceContainerLow,
              borderColor: d.outlineGhost15,
              marginBottom: bottomInset + spacing.md,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: d.onSurface }]}>Profile</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="close" size={26} color={d.onSurfaceVariant} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={d.primary} />
            </View>
          ) : (
            <>
              {profile?.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={styles.avatarLg} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarLg, styles.avatarPlaceholder, { backgroundColor: d.card }]}>
                  <Ionicons name="person" size={40} color={d.onSurfaceVariant} />
                </View>
              )}

              <Text style={[styles.name, { color: d.onSurface }]}>{profile?.displayName ?? '—'}</Text>
              <Text style={[styles.email, { color: d.secondary }]}>{profile?.email ?? '—'}</Text>

              <View style={[styles.idRow, { borderTopColor: d.outlineGhost15 }]}>
                <Text style={[styles.idLabel, { color: d.onSurfaceVariant }]}>User ID</Text>
                <Text style={[styles.idValue, { color: d.onSurface }]} selectable>
                  {profile?.id ?? '—'}
                </Text>
              </View>

              <Pressable
                onPress={onSignOut}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.signOutBtn,
                  { borderColor: d.error, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Text style={[styles.signOutLabel, { color: d.error }]}>SIGN OUT</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(6, 10, 18, 0.72)',
  },
  sheet: {
    marginHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    zIndex: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  idRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  idValue: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  signOutBtn: {
    paddingVertical: spacing.md + 2,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  signOutLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
