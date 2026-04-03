import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, spacing } from '../../theme';

type CardProps = ViewProps & { children: React.ReactNode };

export function Card({ style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: spacing.md,
    // No-line rule: hierarchy via surface tier, not outlines
    shadowColor: '#171c1f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
  },
});
