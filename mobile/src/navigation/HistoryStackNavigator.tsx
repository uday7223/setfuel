import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HistoryCalendarScreen, HistoryDayDetailScreen } from '../screens/history';
import type { HistoryStackParamList } from './types';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export function HistoryStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="HistoryCalendar" component={HistoryCalendarScreen} />
      <Stack.Screen name="HistoryDayDetail" component={HistoryDayDetailScreen} />
    </Stack.Navigator>
  );
}
