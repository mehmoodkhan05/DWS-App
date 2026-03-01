import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAdvanceSalaries } from '../../hooks/useAdvanceSalaries';
import { formatDateOnly } from '../../lib/utils';
import { formatCurrency } from '../../lib/currency';

const GOLD = '#d4af37';
const STATUS_COLORS = {
  pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  approved: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  paid: { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  rejected: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

const AdvanceSalaryPanel = () => {
  const { isAdmin, isManager, user } = useAuth();
  const isAdminOrManager = isAdmin || isManager;
  const { advances, loading, createAdvance, updateAdvance, updateStatus, deleteAdvance } = useAdvanceSalaries();

  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [form, setForm] = useState({ amount: '', request_date: '', reason: '' });

  const myAdvances = useMemo(() => {
    let list = isAdminOrManager ? advances : advances.filter((a) => a.employee_id === user?.id);
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter);
    return list.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));
  }, [advances, statusFilter, isAdminOrManager, user]);

  const stats = useMemo(() => {
    const base = isAdminOrManager ? advances : advances.filter((a) => a.employee_id === user?.id);
    return {
      pending: base.filter((a) => a.status === 'pending').length,
      pendingAmount: base.filter((a) => a.status === 'pending').reduce((s, a) => s + parseFloat(a.amount || 0), 0),
    };
  }, [advances, isAdminOrManager, user]);

  const handleCreate = async () => {
    if (!form.amount || isNaN(parseFloat(form.amount))) { Alert.alert('Validation', 'Please enter a valid amount.'); return; }
    if (!form.request_date) { Alert.alert('Validation', 'Please enter a request date (YYYY-MM-DD).'); return; }
    if (!form.reason.trim()) { Alert.alert('Validation', 'Please enter a reason.'); return; }
    try {
      setSubmitting(true);
      await createAdvance({ amount: parseFloat(form.amount), request_date: form.request_date, reason: form.reason });
      setForm({ amount: '', request_date: '', reason: '' });
      setShowCreateModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (advance) => {
    Alert.alert('Approve Advance', `Approve advance of ${formatCurrency(advance.amount)} for ${advance.employee_name || 'employee'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try { await updateStatus(advance.id, 'approved', null, null); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleReject = (advance) => {
    setSelectedAdvance(advance);
    setRejectionReason('');
    setAdminNotes('');
    setShowStatusModal(true);
  };

  const handleMarkPaid = (advance) => {
    Alert.alert('Mark as Paid', `Mark this advance of ${formatCurrency(advance.amount)} as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid',
        onPress: async () => {
          try { await updateStatus(advance.id, 'paid', null, null); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleSubmitRejection = async () => {
    if (!rejectionReason.trim()) { Alert.alert('Validation', 'Please provide a rejection reason.'); return; }
    try {
      setSubmitting(true);
      await updateStatus(selectedAdvance.id, 'rejected', rejectionReason, adminNotes || null);
      setShowStatusModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Request', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteAdvance(id); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending Requests</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
          <Text style={styles.statValue}>{formatCurrency(stats.pendingAmount)}</Text>
          <Text style={styles.statLabel}>Pending Amount</Text>
        </View>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Advance Salary</Text>
        {!isAdminOrManager && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Request Advance</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.filterRow}>
          {['all', 'pending', 'approved', 'paid', 'rejected'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* List */}
      {myAdvances.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cash-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No advance salary requests</Text>
        </View>
      ) : (
        myAdvances.map((adv) => (
          <View key={adv.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.advanceAmount}>{formatCurrency(adv.amount)}</Text>
                {isAdminOrManager && adv.employee_name && (
                  <Text style={styles.employeeName}>{adv.employee_name}</Text>
                )}
              </View>
              <StatusBadge status={adv.status} />
            </View>

            <Text style={styles.reason}>{adv.reason}</Text>

            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
              <Text style={styles.dateText}>{formatDateOnly(adv.request_date)}</Text>
            </View>

            {adv.rejection_reason && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                <Text style={styles.rejectionText}>{adv.rejection_reason}</Text>
              </View>
            )}

            {adv.admin_notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Admin Notes:</Text>
                <Text style={styles.notesText}>{adv.admin_notes}</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              {isAdminOrManager && adv.status === 'pending' && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(adv)}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(adv)}>
                    <Ionicons name="close" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
              {isAdminOrManager && adv.status === 'approved' && (
                <TouchableOpacity style={[styles.actionBtn, styles.paidBtn]} onPress={() => handleMarkPaid(adv)}>
                  <Ionicons name="receipt-outline" size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Mark Paid</Text>
                </TouchableOpacity>
              )}
              {!isAdminOrManager && adv.status === 'pending' && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(adv.id)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Advance Salary</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Amount (Rs) *</Text>
              <TextInput style={styles.input} placeholder="0.00" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />

              <Text style={styles.label}>Request Date (YYYY-MM-DD) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 2026-03-01" value={form.request_date} onChangeText={(v) => setForm({ ...form, request_date: v })} />

              <Text style={styles.label}>Reason *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Reason for advance..." value={form.reason} onChangeText={(v) => setForm({ ...form, reason: v })} multiline numberOfLines={3} />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal visible={showStatusModal} transparent animationType="slide" onRequestClose={() => setShowStatusModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Advance</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Rejection Reason *</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Reason for rejection..." value={rejectionReason} onChangeText={setRejectionReason} multiline numberOfLines={3} />

            <Text style={styles.label}>Admin Notes (optional)</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Additional notes..." value={adminNotes} onChangeText={setAdminNotes} multiline numberOfLines={2} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStatusModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#ef4444' }]} onPress={handleSubmitRejection} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterBtnText: { fontSize: 13, color: '#374151' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  advanceAmount: { fontSize: 20, fontWeight: '700', color: '#111827' },
  employeeName: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  reason: { fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 18 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  dateText: { fontSize: 12, color: '#9ca3af' },
  rejectionBox: { backgroundColor: '#fef2f2', borderRadius: 6, padding: 8, marginBottom: 6 },
  rejectionLabel: { fontSize: 11, fontWeight: '600', color: '#991b1b', marginBottom: 2 },
  rejectionText: { fontSize: 12, color: '#991b1b' },
  notesBox: { backgroundColor: '#f0fdf4', borderRadius: 6, padding: 8, marginBottom: 6 },
  notesLabel: { fontSize: 11, fontWeight: '600', color: '#166534', marginBottom: 2 },
  notesText: { fontSize: 12, color: '#166534' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  paidBtn: { backgroundColor: '#3b82f6' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default AdvanceSalaryPanel;
