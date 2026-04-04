import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { DietTrackerScreen } from '../screens/diet/DietTrackerScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { WorkoutTrackerScreen } from '../screens/workout/WorkoutTrackerScreen';
import { dashboard } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const d = dashboard;

function PillTabBarButton({ style, accessibilityState, ...rest }: BottomTabBarButtonProps) {
  const focused = accessibilityState?.selected ?? false;
  return (
    <PlatformPressable
      {...rest}
      accessibilityState={accessibilityState}
      style={[
        styles.tabBtn,
        style,
        focused && styles.tabBtnActive,
      ]}
    />
  );
}

function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={60}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: `${d.background}e6` }]} />;
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: d.primary,
        tabBarInactiveTintColor: d.onSurfaceVariant,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <TabBarBackground />,
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
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 0,
    shadowColor: '#171c1f',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    paddingTop: 6,
    paddingHorizontal: 10,
    height: 80,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginVertical: 4,
  },
  tabBtnActive: {
    backgroundColor: `${d.primary}1a`,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
