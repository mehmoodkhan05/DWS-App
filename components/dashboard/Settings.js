import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';

const GOLD = '#d4af37';

const SETTINGS_MENU_ITEMS = [
  { icon: 'person-outline', label: 'Profile', route: 'Profile' },
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
  { icon: 'shield-outline', label: 'Security', route: 'Security' },
  { icon: 'notifications-outline', label: 'Alerts', route: 'Notifications' },
  { icon: 'settings-outline', label: 'System', route: 'System' },
];

const SectionTitle = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const MenuItem = ({ icon, label, onPress, isLast }) => (
  <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast]} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuIconWrap}>
      <Ionicons name={icon} size={22} color={GOLD} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
  </TouchableOpacity>
);

const Settings = () => {
  const navigation = useNavigation();
  const { isAdmin, isManager } = useAuth();

  const filteredItems = SETTINGS_MENU_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin && !isManager) return false;
    return true;
  });

  const appItems = filteredItems.filter((i) =>
    ['Profile', 'Requests', 'Announcements', 'Expenses', 'AdvanceSalary', 'Salary', 'EmployeeManagement', 'RotaManagement', 'FinancialManagement', 'Reports', 'AuditLog'].includes(i.route)
  );
  const settingItems = filteredItems.filter((i) =>
    ['Security', 'Notifications', 'System'].includes(i.route)
  );

  const navigateTo = (route) => {
    navigation.navigate(route);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <SectionTitle title="App" />
      <View style={styles.card}>
        {appItems.map((item, idx) => (
          <MenuItem
            key={item.route}
            icon={item.icon}
            label={item.label}
            onPress={() => navigateTo(item.route)}
            isLast={idx === appItems.length - 1}
          />
        ))}
      </View>

      <SectionTitle title="Preferences" />
      <View style={styles.card}>
        {settingItems.map((item, idx) => (
          <MenuItem
            key={item.route}
            icon={item.icon}
            label={item.label}
            onPress={() => navigateTo(item.route)}
            isLast={idx === settingItems.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
});

export default Settings;
