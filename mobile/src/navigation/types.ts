import type { NavigatorScreenParams } from '@react-navigation/native';

export type HistoryStackParamList = {
  HistoryCalendar: undefined;
  HistoryDayDetail: { date: string };
};

export type MainTabParamList = {
  Home: undefined;
  Workout: undefined;
  Diet: undefined;
  History: NavigatorScreenParams<HistoryStackParamList> | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};
