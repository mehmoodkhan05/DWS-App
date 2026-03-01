import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuditLog } from '../../hooks/useAuditLog';
import { formatDateOnly } from '../../lib/utils';

const GOLD = '#d4af37';

const SEVERITY_COLORS = {
  low: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  medium: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  high: { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  critical: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
};

const CATEGORY_ICONS = {
  authentication: 'key-outline',
  data_modification: 'create-outline',
  system_access: 'shield-outline',
  security: 'lock-closed-outline',
  configuration: 'settings-outline',
};

const SeverityBadge = ({ severity }) => {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.severityDot, { backgroundColor: c.dot }]} />
      <Text style={[styles.badgeText, { color: c.text }]}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Text>
    </View>
  );
};

const AuditLog = () => {
  const { auditEntries, loading, refetch } = useAuditLog();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);

  const severityCounts = useMemo(() => ({
    low: auditEntries.filter((e) => e.severity === 'low').length,
    medium: auditEntries.filter((e) => e.severity === 'medium').length,
    high: auditEntries.filter((e) => e.severity === 'high').length,
    critical: auditEntries.filter((e) => e.severity === 'critical').length,
  }), [auditEntries]);

  const filtered = useMemo(() => {
    let list = auditEntries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.user_name?.toLowerCase().includes(q) ||
          e.action?.toLowerCase().includes(q) ||
          e.resource?.toLowerCase().includes(q),
      );
    }
    if (severityFilter !== 'all') list = list.filter((e) => e.severity === severityFilter);
    if (categoryFilter !== 'all') list = list.filter((e) => e.category === categoryFilter);
    return list;
  }, [auditEntries, search, severityFilter, categoryFilter]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Severity Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.statsRow}>
          {['low', 'medium', 'high', 'critical'].map((sev) => {
            const c = SEVERITY_COLORS[sev];
            return (
              <View key={sev} style={[styles.statCard, { borderLeftColor: c.dot }]}>
                <View style={[styles.severityDot, { backgroundColor: c.dot, width: 10, height: 10, marginBottom: 4 }]} />
                <Text style={styles.statValue}>{severityCounts[sev]}</Text>
                <Text style={styles.statLabel}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search user, action, resource..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Severity Filter */}
      <Text style={styles.filterLabel}>Severity</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <View style={styles.filterRow}>
          {['all', 'low', 'medium', 'high', 'critical'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterBtn, severityFilter === s && styles.filterBtnActive]}
              onPress={() => setSeverityFilter(s)}
            >
              <Text style={[styles.filterBtnText, severityFilter === s && styles.filterBtnTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Category Filter */}
      <Text style={styles.filterLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.filterRow}>
          {['all', 'authentication', 'data_modification', 'system_access', 'security', 'configuration'].map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.filterBtn, categoryFilter === c && styles.filterBtnActive]}
              onPress={() => setCategoryFilter(c)}
            >
              <Text style={[styles.filterBtnText, categoryFilter === c && styles.filterBtnTextActive]}>
                {c === 'all' ? 'All' : c.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} entries</Text>

      {/* Entries */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No audit entries found</Text>
        </View>
      ) : (
        filtered.map((entry) => (
          <TouchableOpacity key={entry.id} style={styles.card} onPress={() => setSelectedEntry(entry)}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons
                  name={CATEGORY_ICONS[entry.category] || 'document-outline'}
                  size={16}
                  color="#6b7280"
                  style={{ marginRight: 6 }}
                />
                <View>
                  <Text style={styles.actionText}>{entry.action}</Text>
                  <Text style={styles.resourceText}>{entry.resource}</Text>
                </View>
              </View>
              <SeverityBadge severity={entry.severity} />
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.userRow}>
                <Ionicons name="person-outline" size={12} color="#9ca3af" />
                <Text style={styles.userName}>{entry.user_name || 'System'}</Text>
              </View>
              <Text style={styles.timestamp}>
                {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Audit Entry Details</Text>
              <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {selectedEntry && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <DetailRow label="User" value={selectedEntry.user_name || 'System'} />
                <DetailRow label="Email" value={selectedEntry.user_email || '—'} />
                <DetailRow label="Action" value={selectedEntry.action} />
                <DetailRow label="Resource" value={selectedEntry.resource} />
                <DetailRow label="Severity" value={selectedEntry.severity} />
                <DetailRow label="Category" value={selectedEntry.category?.replace('_', ' ')} />
                {selectedEntry.details && (
                  <DetailRow label="Details" value={selectedEntry.details} />
                )}
                {selectedEntry.ip_address && (
                  <DetailRow label="IP Address" value={selectedEntry.ip_address} />
                )}
                {selectedEntry.user_agent && (
                  <DetailRow label="User Agent" value={selectedEntry.user_agent} />
                )}
                <DetailRow
                  label="Timestamp"
                  value={selectedEntry.created_at ? new Date(selectedEntry.created_at).toLocaleString() : '—'}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, minWidth: 80, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterBtnText: { fontSize: 12, color: '#374151' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  resultCount: { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  resourceText: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { fontSize: 12, color: '#6b7280' },
  timestamp: { fontSize: 11, color: '#9ca3af' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: '#111827' },
});

export default AuditLog;
