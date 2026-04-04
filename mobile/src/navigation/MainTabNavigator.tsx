import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { DietTrackerScreen } from '../screens/diet/DietTrackerScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { WorkoutTrackerScreen } from '../screens/workout/WorkoutTrackerScreen';
import { dashboard } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function PillTabBarButton({ style, accessibilityState, ...rest }: BottomTabBarButtonProps) {
  const focused = accessibilityState?.selected ?? false;
  const d = dashboard;
  return (
    <PlatformPressable
      {...rest}
      accessibilityState={accessibilityState}
      style={[styles.tabBtn, style, focused && { backgroundColor: d.tabActivePill, borderRadius: 20 }]}
    />
  );
}

export function MainTabNavigator() {
  const d = dashboard;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: d.tabActive,
        tabBarInactiveTintColor: d.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          backgroundColor: d.tabBarBg,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          elevation: 20,
          shadowColor: '#171c1f',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.06,
          shadowRadius: 24,
          paddingTop: 10,
          paddingHorizontal: 10,
          height: 72,
        },
        tabBarButton: (props) => <PillTabBarButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutTrackerScreen}
        options={{
          tabBarLabel: 'WORKOUT',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Diet"
        component={DietTrackerScreen}
        options={{
          tabBarLabel: 'DIET',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
});
