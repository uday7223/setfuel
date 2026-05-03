import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import type { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth gate: one stack, screens swap when `isSignedIn` changes.
 * A blank view is shown while the stored session token is being validated
 * (prevents a flash of LoginScreen on every cold start for signed-in users).
 */
export function RootNavigator() {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {isSignedIn ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
