import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useExpenses } from '../../hooks/useExpenses';
import { useProfiles } from '../../hooks/useProfiles';
import { formatDateOnly } from '../../lib/utils';
import { formatCurrency } from '../../lib/currency';

const GOLD = '#d4af37';
const STATUS_COLORS = {
  approved: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  paid: { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  rejected: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
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

const StatCard = ({ label, value, icon, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 4 }} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ExpensesPanel = () => {
  const { isAdmin, isManager, user } = useAuth();
  const isAdminOrManager = isAdmin || isManager;
  const { expenses, categories, loading, createExpense, deleteExpense } = useExpenses();
  const { profiles } = useProfiles();

  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    expense_date: '',
    receipt_url: '',
    is_office_expense: false,
    employee_id: '',
  });

  const myExpenses = useMemo(() => {
    let list = isAdminOrManager ? expenses : expenses.filter((e) => e.employee_id === user?.id);
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    return list.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  }, [expenses, statusFilter, isAdminOrManager, user]);

  const stats = useMemo(() => {
    const base = isAdminOrManager ? expenses : expenses.filter((e) => e.employee_id === user?.id);
    return {
      total: base.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      approved: base.filter((e) => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      paid: base.filter((e) => e.status === 'paid').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    };
  }, [expenses, isAdminOrManager, user]);

  const handleSubmit = async () => {
    if (!form.amount || isNaN(parseFloat(form.amount))) { Alert.alert('Validation', 'Please enter a valid amount.'); return; }
    if (!form.expense_date) { Alert.alert('Validation', 'Please enter a date (YYYY-MM-DD).'); return; }
    if (!form.description.trim()) { Alert.alert('Validation', 'Please enter a description.'); return; }
    try {
      setSubmitting(true);
      const data = {
        amount: parseFloat(form.amount),
        description: form.description,
        expense_date: form.expense_date,
        receipt_url: form.receipt_url || null,
        category_id: form.category_id || null,
      };
      if (isAdminOrManager) {
        if (form.is_office_expense) {
          data.employee_id = null;
        } else {
          data.employee_id = form.employee_id || user?.id;
        }
      }
      await createExpense(data);
      setForm({ category_id: '', amount: '', description: '', expense_date: '', receipt_url: '', is_office_expense: false, employee_id: '' });
      setShowModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteExpense(id); } catch (e) { Alert.alert('Error', e.message); }
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.statsRow}>
          <StatCard label="Total" value={formatCurrency(stats.total)} icon="receipt-outline" color="#6b7280" />
          <StatCard label="Approved" value={formatCurrency(stats.approved)} icon="checkmark-circle-outline" color="#10b981" />
          <StatCard label="Paid" value={formatCurrency(stats.paid)} icon="cash-outline" color="#3b82f6" />
        </View>
      </ScrollView>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Expenses</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Submit Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.filterRow}>
          {['all', 'approved', 'paid', 'rejected'].map((s) => (
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
      {myExpenses.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No expenses found</Text>
        </View>
      ) : (
        myExpenses.map((exp) => (
          <View key={exp.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <Text style={styles.expenseAmount}>{formatCurrency(exp.amount)}</Text>
                <Text style={styles.expenseCategory}>{exp.category_name || 'Uncategorized'}</Text>
              </View>
              <StatusBadge status={exp.status} />
            </View>
            <Text style={styles.expenseDesc}>{exp.description}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
                <Text style={styles.dateText}>{formatDateOnly(exp.expense_date)}</Text>
              </View>
              {isAdminOrManager && exp.employee_name && (
                <Text style={styles.employeeText}>{exp.employee_name}</Text>
              )}
              {(isAdminOrManager || exp.status === 'pending') && (
                <TouchableOpacity onPress={() => handleDelete(exp.id)}>
                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      {/* Create Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Submit Expense</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[styles.optionBtn, !form.category_id && styles.optionBtnActive]}
                    onPress={() => setForm({ ...form, category_id: '' })}
                  >
                    <Text style={[styles.optionBtnText, !form.category_id && styles.optionBtnTextActive]}>None</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.optionBtn, form.category_id === cat.id?.toString() && styles.optionBtnActive]}
                      onPress={() => setForm({ ...form, category_id: cat.id?.toString() })}
                    >
                      <Text style={[styles.optionBtnText, form.category_id === cat.id?.toString() && styles.optionBtnTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Amount (Rs) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={form.amount}
                onChangeText={(v) => setForm({ ...form, amount: v })}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-03-01"
                value={form.expense_date}
                onChangeText={(v) => setForm({ ...form, expense_date: v })}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the expense..."
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Receipt URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                value={form.receipt_url}
                onChangeText={(v) => setForm({ ...form, receipt_url: v })}
                autoCapitalize="none"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 2 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderLeftWidth: 4, minWidth: 110, alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
    minHeight: 44,
  },
  filterBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterBtnText: { fontSize: 13, color: '#374151' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardLeft: {},
  expenseAmount: { fontSize: 18, fontWeight: '700', color: '#111827' },
  expenseCategory: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  expenseDesc: { fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: '#9ca3af' },
  employeeText: { fontSize: 12, color: '#6b7280' },
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
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  optionBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  optionBtnText: { fontSize: 13, color: '#374151' },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default ExpensesPanel;
