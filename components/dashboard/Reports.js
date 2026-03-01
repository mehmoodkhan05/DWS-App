import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfiles } from '../../hooks/useProfiles';
import { useRequests } from '../../hooks/useRequests';
import { useRotas } from '../../hooks/useRotas';

const GOLD = '#d4af37';

const StatCard = ({ label, value, icon, color, subtitle }) => (
  <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

const BarRow = ({ label, value, max, color }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
};

const Reports = () => {
  const { profiles, loading: loadingProfiles } = useProfiles();
  const { requests, loading: loadingRequests } = useRequests();
  const { rotas, loading: loadingRotas } = useRotas();

  const loading = loadingProfiles || loadingRequests || loadingRotas;

  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const totalEmployees = profiles.filter((p) => p.is_active).length;
    const totalRequests = requests.length;
    const todayShifts = rotas.filter((r) => r.date === today).length;
    const pendingRequests = requests.filter((r) => r.status === 'pending').length;
    const approvedRequests = requests.filter((r) => r.status === 'approved').length;
    const rejectedRequests = requests.filter((r) => r.status === 'rejected').length;

    const roleDist = {
      admin: profiles.filter((p) => p.role === 'admin').length,
      manager: profiles.filter((p) => p.role === 'manager').length,
      employee: profiles.filter((p) => p.role === 'employee').length,
    };

    return { totalEmployees, totalRequests, todayShifts, pendingRequests, approvedRequests, rejectedRequests, roleDist };
  }, [profiles, requests, rotas, today]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  const maxRole = Math.max(stats.roleDist.admin, stats.roleDist.manager, stats.roleDist.employee, 1);
  const maxReq = Math.max(stats.pendingRequests, stats.approvedRequests, stats.rejectedRequests, 1);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overview Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total Employees" value={stats.totalEmployees} icon="people-outline" color="#3b82f6" />
        <StatCard label="Total Requests" value={stats.totalRequests} icon="document-text-outline" color={GOLD} />
        <StatCard label="Today's Shifts" value={stats.todayShifts} icon="calendar-outline" color="#10b981" />
        <StatCard label="Efficiency" value="92%" icon="trending-up-outline" color="#8b5cf6" subtitle="Target met" />
      </View>

      {/* Role Distribution */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Role Distribution</Text>
        <BarRow label="Admins" value={stats.roleDist.admin} max={maxRole} color={GOLD} />
        <BarRow label="Managers" value={stats.roleDist.manager} max={maxRole} color="#3b82f6" />
        <BarRow label="Employees" value={stats.roleDist.employee} max={maxRole} color="#10b981" />
      </View>

      {/* Request Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Request Status</Text>
        <BarRow label="Pending" value={stats.pendingRequests} max={maxReq} color="#f59e0b" />
        <BarRow label="Approved" value={stats.approvedRequests} max={maxReq} color="#10b981" />
        <BarRow label="Rejected" value={stats.rejectedRequests} max={maxReq} color="#ef4444" />
      </View>

      {/* Recent Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Requests</Text>
        {requests.slice(0, 5).map((req) => (
          <View key={req.id} style={styles.activityRow}>
            <View style={[styles.activityDot, {
              backgroundColor: req.status === 'approved' ? '#10b981' : req.status === 'rejected' ? '#ef4444' : '#f59e0b',
            }]} />
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{req.employee_name || 'Employee'}</Text>
              <Text style={styles.activityType}>{req.type} request — {req.status}</Text>
            </View>
            <Text style={styles.activityDate}>
              {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
            </Text>
          </View>
        ))}
        {requests.length === 0 && (
          <Text style={styles.emptyText}>No recent requests</Text>
        )}
      </View>

      {/* Employee Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Employee Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{profiles.filter((p) => p.is_active).length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{profiles.filter((p) => !p.is_active).length}</Text>
            <Text style={styles.summaryLabel}>Inactive</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: GOLD }]}>{stats.roleDist.admin}</Text>
            <Text style={styles.summaryLabel}>Admins</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>{stats.roleDist.manager}</Text>
            <Text style={styles.summaryLabel}>Managers</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    width: '48%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  statSubtitle: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { fontSize: 13, color: '#374151', width: 70 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 13, fontWeight: '600', color: '#374151', width: 30, textAlign: 'right' },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  activityInfo: { flex: 1 },
  activityName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  activityType: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  activityDate: { fontSize: 11, color: '#9ca3af' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 10 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});

export default Reports;
