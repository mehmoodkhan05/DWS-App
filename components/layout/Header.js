import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, Image, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useMessages } from '../../hooks/useMessages';
import { useRequests } from '../../hooks/useRequests';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAvatarUrl } from '../../config/api';

const Header = () => {
  const insets = useSafeAreaInsets();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { profile, logout, isAdmin, isManager } = useAuth();
  const avatarUrl = getAvatarUrl(profile?.avatar_url);
  const showAvatarImage = avatarUrl && !avatarError;

  useEffect(() => {
    setAvatarError(false);
  }, [profile?.avatar_url]);
  const { messages, markAsRead } = useMessages(profile?.id);
  const { requests } = useRequests();
  const { announcements } = useAnnouncements();

  const unreadMessagesCount = useMemo(() => {
    if (!messages) return 0;
    return messages.filter(m => !m.is_read && (m.recipient_id === profile?.id)).length;
  }, [messages, profile?.id]);

  const pendingRequestsCount = useMemo(() => {
    if (!requests) return 0;
    if (profile?.role === 'admin' || profile?.role === 'manager') {
      return requests.filter(r => r.status === 'pending').length;
    }
    return requests.filter(r => r.status === 'pending' && r.employee_id === profile?.id).length;
  }, [requests, profile?.role, profile?.id]);

  const newAnnouncementsCount = useMemo(() => {
    if (!announcements) return 0;
    const now = new Date();
    return announcements.filter(a => {
      const notExpired = !a.expires_at || new Date(a.expires_at) > now;
      return notExpired;
    }).length;
  }, [announcements]);

  const totalNotifications = unreadMessagesCount + pendingRequestsCount + newAnnouncementsCount;

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const navigateToScreen = (screenName) => {
    const tabScreens = ['Dashboard', 'Schedule', 'Messages', 'Settings'];
    if (tabScreens.includes(screenName)) {
      navigation.navigate('MainTabs', { screen: screenName });
    } else {
      navigation.navigate(screenName);
    }
  };

  const statusBarHeight = Platform.OS === 'android' && insets.top === 0
    ? (StatusBar.currentHeight ?? 24)
    : insets.top;
  const headerTopPadding = Math.max(statusBarHeight, 8);
  const dropdownTop = headerTopPadding + 52;

  const canGoBack = navigation.canGoBack();
  const routeLabels = { Profile: 'Profile', Requests: 'Requests', Announcements: 'Announcements', Expenses: 'Expenses', AdvanceSalary: 'Advance Salary', Salary: 'Salary Details', EmployeeManagement: 'Employee Management', RotaManagement: 'Rota Management', FinancialManagement: 'Financial Management', Reports: 'Reports', AuditLog: 'Audit Log', Security: 'Security', Notifications: 'Alerts', System: 'System' };
  const screenTitle = routeLabels[route.name] || route.name;

  return (
    <View style={[styles.header, { paddingTop: headerTopPadding + 14 }]}>
      <View style={styles.leftSection}>
        {canGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
        )}
        <View style={[styles.logoWrapper, canGoBack && styles.logoWrapperSmall]}>
          <Ionicons name="shield" size={canGoBack ? 18 : 22} color="#d4af37" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {canGoBack ? screenTitle : 'Delta Watch Security'}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigateToScreen('Messages')}
        >
          <Ionicons name="notifications-outline" size={22} color="#374151" />
          {totalNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {Math.min(totalNotifications, 99)}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setDropdownVisible(true)}
          activeOpacity={0.7}
        >
          {showAvatarImage ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              onError={() => setAvatarError(true)}
              onLoad={() => setAvatarError(false)}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <Pressable
          style={[styles.dropdownOverlay, { paddingTop: dropdownTop, paddingRight: 18 }]}
          onPress={() => setDropdownVisible(false)}
        >
          <Pressable style={styles.dropdown} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                navigateToScreen('Profile');
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="person-outline" size={22} color="#6b7280" />
              <Text style={styles.dropdownItemText}>Profile</Text>
            </TouchableOpacity>
            <View style={styles.dropdownDivider} />
            <TouchableOpacity
              style={[styles.dropdownItem, styles.dropdownItemDanger]}
              onPress={() => {
                setDropdownVisible(false);
                handleLogout();
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text style={[styles.dropdownItemText, styles.dropdownItemTextDanger]}>Logout</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 58,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  logoWrapperSmall: {
    width: 32,
    height: 32,
  },
  logoWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    justifyContent: 'center',
    flexShrink: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
    lineHeight: 14,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    minWidth: 100,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  iconButton: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d4af37',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    minWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
    borderRadius: 10,
  },
  dropdownItemDanger: {},
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dropdownItemTextDanger: {
    color: '#ef4444',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 2,
  },
});

export default Header;
