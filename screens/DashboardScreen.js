import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../hooks/useProfiles';
import { useRequests } from '../hooks/useRequests';
import { useRotas } from '../hooks/useRotas';
import DashboardStats from '../components/dashboard/DashboardStats';
import RotaCalendar from '../components/calendar/RotaCalendar';
import RequestsPanel from '../components/requests/RequestsPanel';
import AnnouncementsPanel from '../components/announcements/AnnouncementsPanel';
import { Ionicons } from '@expo/vector-icons';

const DashboardScreen = () => {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Refresh data
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back, {profile?.full_name || 'User'}</Text>
        <Text style={styles.subtitle}>Here's your dashboard overview for today</Text>
      </View>

      <DashboardStats />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Schedule</Text>
        <RotaCalendar />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requests</Text>
        <RequestsPanel />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Announcements</Text>
        <AnnouncementsPanel />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
});

export default DashboardScreen;
