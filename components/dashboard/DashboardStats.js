import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useProfiles } from '../../hooks/useProfiles';
import { useRequests } from '../../hooks/useRequests';
import { useRotas } from '../../hooks/useRotas';
import { Ionicons } from '@expo/vector-icons';

const StatCard = ({ title, value, icon, description }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Ionicons name={icon} size={20} color="#d4af37" />
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardValue}>{value}</Text>
      {description && <Text style={styles.cardDescription}>{description}</Text>}
    </View>
  </View>
);

const DashboardStats = () => {
  const { isAdmin, isManager, user } = useAuth();
  const { profiles } = useProfiles();
  const { requests } = useRequests();
  const { rotas } = useRotas();

  const today = new Date().toISOString().split('T')[0];
  const todayRotas = rotas.filter(rota => rota.date === today);
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const activeEmployees = profiles.filter(p => p.is_active);
  const userRequests = requests.filter(req => req.employee_id === user?.id && req.status === 'pending');
  const userTodayRota = rotas.find(rota => rota.employee_id === user?.id && rota.date === today);

  const adminStats = [
    {
      title: 'Total Employees',
      value: activeEmployees.length,
      icon: 'people',
      description: 'Active personnel',
    },
    {
      title: 'Pending Requests',
      value: pendingRequests.length,
      icon: 'alert-circle',
      description: 'Awaiting approval',
    },
    {
      title: "Today's Shifts",
      value: todayRotas.length,
      icon: 'time',
      description: 'Active shifts today',
    },
    {
      title: 'Total Requests',
      value: requests.length,
      icon: 'checkmark-circle',
      description: 'All time requests',
    },
  ];

  const employeeStats = [
    {
      title: 'My Requests',
      value: userRequests.length,
      icon: 'alert-circle',
      description: 'Pending requests',
    },
    {
      title: "Today's Shift",
      value: userTodayRota?.shift_pattern?.name || 'Off',
      icon: 'time',
      description: userTodayRota?.shift_pattern?.start_time
        ? `${userTodayRota.shift_pattern.start_time} - ${userTodayRota.shift_pattern.end_time}`
        : 'No shift scheduled',
    },
    {
      title: 'Total Employees',
      value: activeEmployees.length,
      icon: 'people',
      description: 'Team members',
    },
    {
      title: 'Team Requests',
      value: pendingRequests.length,
      icon: 'checkmark-circle',
      description: 'Pending approvals',
    },
  ];

  const stats = (isAdmin || isManager) ? adminStats : employeeStats;

  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardContent: {
    marginTop: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});

export default DashboardStats;
