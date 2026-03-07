import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useRotas } from '../../hooks/useRotas';
import { useProfiles } from '../../hooks/useProfiles';
import { formatDateOnly } from '../../lib/utils';

const GOLD = '#d4af37';
const STATUS_COLORS = {
  pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  approved: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  rejected: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};
const TYPE_LABELS = { leave: 'Leave', shift_swap: 'Shift Swap', overtime: 'Overtime' };

const StatusBadge = ({ status }) => {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

const RequestCard = ({ request, isAdminOrManager, onApprove, onReject, onDelete }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleRow}>
        <View style={[styles.typeBadge]}>
          <Text style={styles.typeBadgeText}>{TYPE_LABELS[request.type] || request.type}</Text>
        </View>
        {isAdminOrManager && (
          <Text style={styles.employeeName}>{request.employee_name}</Text>
        )}
      </View>
      <StatusBadge status={request.status} />
    </View>

    {(request.start_date || request.end_date) && (
      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text style={styles.dateText}>
          {formatDateOnly(request.start_date)}
          {request.end_date && request.end_date !== request.start_date
            ? ` → ${formatDateOnly(request.end_date)}`
            : ''}
        </Text>
      </View>
    )}

    {request.reason && (
      <Text style={styles.reason}>{request.reason}</Text>
    )}

    {request.admin_notes && (
      <View style={styles.adminNotes}>
        <Text style={styles.adminNotesLabel}>Admin Notes:</Text>
        <Text style={styles.adminNotesText}>{request.admin_notes}</Text>
      </View>
    )}

    <View style={styles.cardFooter}>
      <Text style={styles.submittedAt}>
        Submitted {formatDateOnly(request.created_at)}
      </Text>
      {isAdminOrManager && request.status === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => onApprove(request.id)}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => onReject(request.id)}
          >
            <Ionicons name="close" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
      {isAdminOrManager && (
        <TouchableOpacity onPress={() => onDelete(request.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const RequestsPanel = () => {
  const { isAdmin, isManager, user } = useAuth();
  const isAdminOrManager = isAdmin || isManager;
  const { requests, loading, createRequest, updateRequestStatus, deleteRequest } = useRequests();
  const { rotas, shiftPatterns } = useRotas();
  const { profiles } = useProfiles();

  const [activeTab, setActiveTab] = useState('all');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });

  // Shift swap form
  const [swapForm, setSwapForm] = useState({
    my_shift_date: '',
    swap_with_date: '',
    swap_employee_id: '',
    reason: '',
  });

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const filteredRequests = useMemo(() => {
    const myId = user?.id;
    let list = isAdminOrManager ? requests : requests.filter((r) => r.employee_id === myId);
    if (activeTab !== 'all') list = list.filter((r) => r.status === activeTab);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [requests, activeTab, isAdminOrManager, user]);

  const tabCounts = useMemo(() => {
    const myId = user?.id;
    const base = isAdminOrManager ? requests : requests.filter((r) => r.employee_id === myId);
    return {
      all: base.length,
      pending: base.filter((r) => r.status === 'pending').length,
      approved: base.filter((r) => r.status === 'approved').length,
      rejected: base.filter((r) => r.status === 'rejected').length,
    };
  }, [requests, isAdminOrManager, user]);

  // Employees working on a given date (for shift swap)
  const employeesOnDate = useMemo(() => {
    if (!swapForm.swap_with_date) return [];
    return rotas
      .filter((r) => r.date === swapForm.swap_with_date && r.employee_id !== user?.id)
      .map((r) => ({ id: r.employee_id, name: r.employee_name }));
  }, [rotas, swapForm.swap_with_date, user]);

  const myShiftOnDate = useMemo(() => {
    if (!swapForm.my_shift_date) return null;
    return rotas.find((r) => r.date === swapForm.my_shift_date && r.employee_id === user?.id);
  }, [rotas, swapForm.my_shift_date, user]);

  const handleApprove = (id) => {
    Alert.alert('Approve Request', 'Are you sure you want to approve this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await updateRequestStatus(id, 'approved');
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleReject = (id) => {
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateRequestStatus(id, 'rejected');
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Request', 'Are you sure you want to delete this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(id);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.start_date) {
      Alert.alert('Validation', 'Please enter a start date (YYYY-MM-DD).');
      return;
    }
    if (!leaveForm.reason.trim()) {
      Alert.alert('Validation', 'Please enter a reason.');
      return;
    }
    try {
      setSubmitting(true);
      await createRequest({
        type: 'leave',
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date || leaveForm.start_date,
        reason: leaveForm.reason,
      });
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
      setShowLeaveModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSwap = async () => {
    if (!swapForm.my_shift_date || !swapForm.swap_with_date || !swapForm.swap_employee_id) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    try {
      setSubmitting(true);
      await createRequest({
        type: 'shift_swap',
        start_date: swapForm.my_shift_date,
        end_date: swapForm.swap_with_date,
        reason: swapForm.reason || `Shift swap on ${swapForm.my_shift_date} with employee`,
        swap_employee_id: swapForm.swap_employee_id,
      });
      setSwapForm({ my_shift_date: '', swap_with_date: '', swap_employee_id: '', reason: '' });
      setShowSwapModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      {!isAdminOrManager && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLeaveModal(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Request Leave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#1e293b' }]} onPress={() => setShowSwapModal(true)}>
            <Ionicons name="swap-horizontal" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Swap Shift</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
              {tabCounts[tab.key] > 0 && (
                <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && { color: '#fff' }]}>
                    {tabCounts[tab.key]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Request list */}
      {filteredRequests.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No requests found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              isAdminOrManager={isAdminOrManager}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          )}
          scrollEnabled={false}
        />
      )}

      {/* Leave Request Modal */}
      <Modal visible={showLeaveModal} transparent animationType="slide" onRequestClose={() => setShowLeaveModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Leave</Text>
              <TouchableOpacity onPress={() => setShowLeaveModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Start Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-03-15"
              value={leaveForm.start_date}
              onChangeText={(v) => setLeaveForm({ ...leaveForm, start_date: v })}
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="Leave blank for single day"
              value={leaveForm.end_date}
              onChangeText={(v) => setLeaveForm({ ...leaveForm, end_date: v })}
            />

            <Text style={styles.label}>Reason *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason for leave..."
              value={leaveForm.reason}
              onChangeText={(v) => setLeaveForm({ ...leaveForm, reason: v })}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLeaveModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLeave} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shift Swap Modal */}
      <Modal visible={showSwapModal} transparent animationType="slide" onRequestClose={() => setShowSwapModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Swap Shift</Text>
                <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>My Shift Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-03-15"
                value={swapForm.my_shift_date}
                onChangeText={(v) => setSwapForm({ ...swapForm, my_shift_date: v })}
              />
              {myShiftOnDate && (
                <View style={styles.shiftPreview}>
                  <Text style={styles.shiftPreviewText}>
                    Your shift: {myShiftOnDate.shift_pattern?.name || 'Assigned'}
                    {myShiftOnDate.shift_pattern?.start_time ? ` (${myShiftOnDate.shift_pattern.start_time} - ${myShiftOnDate.shift_pattern.end_time})` : ''}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Swap With Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-03-20"
                value={swapForm.swap_with_date}
                onChangeText={(v) => setSwapForm({ ...swapForm, swap_with_date: v, swap_employee_id: '' })}
              />

              {swapForm.swap_with_date && employeesOnDate.length > 0 && (
                <>
                  <Text style={styles.label}>Select Employee to Swap With *</Text>
                  {employeesOnDate.map((emp) => (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.employeeOption,
                        swapForm.swap_employee_id === emp.id && styles.employeeOptionSelected,
                      ]}
                      onPress={() => setSwapForm({ ...swapForm, swap_employee_id: emp.id })}
                    >
                      <Ionicons
                        name={swapForm.swap_employee_id === emp.id ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={swapForm.swap_employee_id === emp.id ? GOLD : '#9ca3af'}
                      />
                      <Text style={styles.employeeOptionText}>{emp.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {swapForm.swap_with_date && employeesOnDate.length === 0 && (
                <Text style={styles.noEmployeesText}>No other employees scheduled on this date.</Text>
              )}

              <Text style={styles.label}>Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Reason for swap (optional)..."
                value={swapForm.reason}
                onChangeText={(v) => setSwapForm({ ...swapForm, reason: v })}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSwapModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitSwap} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Swap</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GOLD, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, flex: 1, justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tabsScroll: { marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 2 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 22, backgroundColor: '#f3f4f6',
    borderWidth: 1, borderColor: '#e5e7eb',
    minHeight: 44,
  },
  activeTab: { backgroundColor: GOLD, borderColor: GOLD },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  tabBadge: {
    backgroundColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  activeTabBadge: { backgroundColor: 'rgba(255,255,255,0.35)' },
  tabBadgeText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitleRow: { flex: 1, marginRight: 8 },
  typeBadge: {
    backgroundColor: '#eff6ff', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  typeBadgeText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  employeeName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  badge: {
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  dateText: { fontSize: 13, color: '#6b7280' },
  reason: { fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 18 },
  adminNotes: {
    backgroundColor: '#f0fdf4', borderRadius: 6,
    padding: 8, marginBottom: 6,
  },
  adminNotesLabel: { fontSize: 11, fontWeight: '600', color: '#166534', marginBottom: 2 },
  adminNotesText: { fontSize: 12, color: '#166534' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  submittedAt: { fontSize: 11, color: '#9ca3af' },
  actionRow: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  shiftPreview: {
    backgroundColor: '#fef3c7', borderRadius: 6, padding: 8, marginTop: 4,
  },
  shiftPreviewText: { fontSize: 12, color: '#92400e' },
  employeeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    marginTop: 6, backgroundColor: '#f9fafb',
  },
  employeeOptionSelected: { borderColor: GOLD, backgroundColor: '#fffbeb' },
  employeeOptionText: { fontSize: 14, color: '#374151' },
  noEmployeesText: { fontSize: 13, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: GOLD, alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default RequestsPanel;
