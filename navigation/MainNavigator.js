import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Header from '../components/layout/Header';
import AdvanceSalaryScreen from '../screens/AdvanceSalaryScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import DashboardScreen from '../screens/DashboardScreen';
import EmployeeManagementScreen from '../screens/EmployeeManagementScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import FinancialManagementScreen from '../screens/FinancialManagementScreen';
import MessagesScreen from '../screens/MessagesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportsScreen from '../screens/ReportsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import RotaManagementScreen from '../screens/RotaManagementScreen';
import SalaryScreen from '../screens/SalaryScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SecurityScreen from '../screens/SecurityScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SystemScreen from '../screens/SystemScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const ACTIVE_COLOR = '#d4af37';
const INACTIVE_COLOR = '#b0b0b0';

const TabIcon = ({ route, focused, color, size }) => {
  const scale = useRef(new Animated.Value(focused ? 1.1 : 1)).current;
  const iconMap = {
    Dashboard: focused ? 'home' : 'home-outline',
    Schedule: focused ? 'calendar' : 'calendar-outline',
    Messages: focused ? 'chatbubbles' : 'chatbubbles-outline',
    Settings: focused ? 'settings' : 'settings-outline',
  };
  const iconName = iconMap[route.name] || 'ellipse-outline';

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 180,
    }).start();
  }, [focused, scale]);

  if (focused) {
    return (
      <Animated.View style={[styles.activeContainer, { transform: [{ scale }] }]}>
        <View style={styles.activeIconWrap}>
          <Ionicons name={iconName} size={size} color="#ffffff" />
        </View>
        <View style={styles.activeDot} />
      </Animated.View>
    );
  }
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={iconName} size={size} color={color} />
    </Animated.View>
  );
};

// No header in Settings stack – Tab Navigator already shows the header once for this tab
const noHeader = { headerShown: false };

// Settings stack: all screens accessible from Settings menu stay inside this tab so the bottom tab bar is always visible
const SettingsStack = () => (
  <Stack.Navigator screenOptions={noHeader}>
    <Stack.Screen name="Settings" component={SettingsScreen} options={noHeader} />
    <Stack.Screen name="Profile" component={ProfileScreen} options={noHeader} />
    <Stack.Screen name="Requests" component={RequestsScreen} options={noHeader} />
    <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={noHeader} />
    <Stack.Screen name="Expenses" component={ExpensesScreen} options={noHeader} />
    <Stack.Screen name="AdvanceSalary" component={AdvanceSalaryScreen} options={noHeader} />
    <Stack.Screen name="Salary" component={SalaryScreen} options={noHeader} />
    <Stack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} options={noHeader} />
    <Stack.Screen name="RotaManagement" component={RotaManagementScreen} options={noHeader} />
    <Stack.Screen name="FinancialManagement" component={FinancialManagementScreen} options={noHeader} />
    <Stack.Screen name="Reports" component={ReportsScreen} options={noHeader} />
    <Stack.Screen name="AuditLog" component={AuditLogScreen} options={noHeader} />
    <Stack.Screen name="Security" component={SecurityScreen} options={noHeader} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={noHeader} />
    <Stack.Screen name="System" component={SystemScreen} options={noHeader} />
  </Stack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      header: () => <Header />,
      tabBarIcon: ({ focused, color, size }) => (
        <TabIcon route={route} focused={focused} color={color} size={size} />
      ),
      tabBarActiveTintColor: ACTIVE_COLOR,
      tabBarInactiveTintColor: INACTIVE_COLOR,
      tabBarStyle: styles.tabBar,
      tabBarShowLabel: true,
      tabBarLabelStyle: styles.tabBarLabel,
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
    <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarLabel: 'My Schedule' }} />
    <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
    <Tab.Screen name="Settings" component={SettingsStack} options={{ tabBarLabel: 'Settings' }} />
  </Tab.Navigator>
);

const MainNavigator = () => {
  return <MainTabs />;
};

const styles = StyleSheet.create({
  activeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTIVE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACTIVE_COLOR,
    marginTop: 6,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0,
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 28 : 14,
    marginTop: 10,
    height: Platform.OS === 'ios' ? 72 : 66,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
});

export default MainNavigator;
