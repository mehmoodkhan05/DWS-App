import React, { useState } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import DashboardScreen from '../screens/DashboardScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import MessagesScreen from '../screens/MessagesScreen';
import RequestsScreen from '../screens/RequestsScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AdvanceSalaryScreen from '../screens/AdvanceSalaryScreen';
import SalaryScreen from '../screens/SalaryScreen';
import EmployeeManagementScreen from '../screens/EmployeeManagementScreen';
import RotaManagementScreen from '../screens/RotaManagementScreen';
import FinancialManagementScreen from '../screens/FinancialManagementScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CustomDrawer from '../components/layout/CustomDrawer';
import Header from '../components/layout/Header';

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

const MainStack = () => {
  const { isAdmin } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <Header />,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Requests" component={RequestsScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="AdvanceSalary" component={AdvanceSalaryScreen} />
      <Stack.Screen name="Salary" component={SalaryScreen} />
      <Stack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} />
      <Stack.Screen name="RotaManagement" component={RotaManagementScreen} />
      <Stack.Screen name="FinancialManagement" component={FinancialManagementScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        // Use simpler animation for Expo Go compatibility
        drawerStyle: {
          width: 280,
        },
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        // Disable gesture handler animations that require reanimated
        gestureEnabled: true,
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="MainStack" component={MainStack} />
    </Drawer.Navigator>
  );
};

export default MainNavigator;
