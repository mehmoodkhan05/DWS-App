import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const DRAWER_ITEMS = [
  { icon: 'calendar-outline', label: 'Dashboard', route: 'Dashboard' },
  { icon: 'calendar', label: 'My Schedule', route: 'Schedule' },
  { icon: 'chatbubbles-outline', label: 'Messages', route: 'Messages' },
  { icon: 'clipboard-outline', label: 'Requests', route: 'Requests' },
  { icon: 'megaphone-outline', label: 'Announcements', route: 'Announcements' },
  { icon: 'cash-outline', label: 'Expenses', route: 'Expenses' },
  { icon: 'wallet-outline', label: 'Advance Salary', route: 'AdvanceSalary' },
  { icon: 'trending-up-outline', label: 'Salary Details', route: 'Salary' },
  { icon: 'people-outline', label: 'Employee Management', route: 'EmployeeManagement', adminOnly: true },
  { icon: 'person-check-outline', label: 'Rota Management', route: 'RotaManagement', adminOnly: true },
  { icon: 'bar-chart-outline', label: 'Financial Management', route: 'FinancialManagement', adminOnly: true },
  { icon: 'bar-chart', label: 'Reports', route: 'Reports', adminOnly: true },
  { icon: 'document-text-outline', label: 'Audit Log', route: 'AuditLog', adminOnly: true },
  { icon: 'settings-outline', label: 'Settings', route: 'Settings', adminOnly: true },
];

const CustomDrawer = (props) => {
  const { isAdmin, isManager } = useAuth();
  const { state, navigation } = props;

  const filteredNavigation = DRAWER_ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin && !isManager) return false;
    return true;
  });

  const getCurrentRoute = () => {
    const route = state.routes[state.index];
    if (!route.state) return route.name;
    const stackRoute = route.state.routes[route.state.index];
    if (stackRoute.name === 'MainTabs' && stackRoute.state?.routes) {
      return stackRoute.state.routes[stackRoute.state.index]?.name ?? 'Dashboard';
    }
    return stackRoute.name;
  };

  const TAB_ROUTES = ['Dashboard', 'Schedule', 'Messages', 'Settings'];

  const navigateTo = (item) => {
    if (TAB_ROUTES.includes(item.route)) {
      navigation.navigate('MainStack', { screen: 'MainTabs', params: { screen: item.route } });
    } else {
      navigation.navigate('MainStack', { screen: item.route });
    }
    props.navigation.closeDrawer();
  };

  const currentRoute = getCurrentRoute();

  return (
    <DrawerContentScrollView {...props} style={styles.drawer}>
      <View style={styles.drawerContent}>
        {filteredNavigation.map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={() => navigateTo(item)}
            >
              <Ionicons
                name={item.icon}
                size={24}
                color={isActive ? '#d4af37' : '#6b7280'}
              />
              <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: '#f9fafb',
  },
  drawerContent: {
    paddingTop: 20,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
  },
  drawerItemActive: {
    backgroundColor: '#d4af37',
  },
  drawerItemText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  drawerItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CustomDrawer;
