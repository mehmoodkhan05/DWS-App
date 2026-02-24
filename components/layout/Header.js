import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useMessages } from '../../hooks/useMessages';
import { useRequests } from '../../hooks/useRequests';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const Header = () => {
  const navigation = useNavigation();
  const { profile, logout, isAdmin, isManager } = useAuth();
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
      navigation.navigate('MainStack', { screen: 'MainTabs', params: { screen: screenName } });
    } else {
      navigation.navigate('MainStack', { screen: screenName });
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <Ionicons name="shield" size={24} color="#d4af37" />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Delta Watch Security</Text>
          <Text style={styles.subtitle}>Staff Management System</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigateToScreen('Messages')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {totalNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {Math.min(totalNotifications, 99)}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigateToScreen('Settings')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || 'User'}
            </Text>
            <Text style={styles.profileRole} numberOfLines={1}>
              {profile?.role || 'employee'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleContainer: {
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  profileInfo: {
    maxWidth: 120,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  profileRole: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  logoutButton: {
    padding: 8,
  },
});

export default Header;
