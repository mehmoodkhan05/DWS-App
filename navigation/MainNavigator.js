import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import CustomDrawer from '../components/layout/CustomDrawer';
import Header from '../components/layout/Header';
import AdvanceSalaryScreen from '../screens/AdvanceSalaryScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import DashboardScreen from '../screens/DashboardScreen';
import EmployeeManagementScreen from '../screens/EmployeeManagementScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import FinancialManagementScreen from '../screens/FinancialManagementScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import RotaManagementScreen from '../screens/RotaManagementScreen';
import SalaryScreen from '../screens/SalaryScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator();
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
      tabBarShowLabel: false,
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
    <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarLabel: 'My Schedule' }} />
    <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
    <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
  </Tab.Navigator>
);

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <Header />,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
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
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0,
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 28 : 12,
    marginTop: 8,
    height: Platform.OS === 'ios' ? 64 : 56,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },
});

export default MainNavigator;
