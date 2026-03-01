import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSalaries } from '../../hooks/useSalaries';
import { useAdvanceSalaries } from '../../hooks/useAdvanceSalaries';
import { useExpenses } from '../../hooks/useExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { useIncome } from '../../hooks/useIncome';
import { useProfiles } from '../../hooks/useProfiles';
import { formatDateOnly } from '../../lib/utils';
import { formatCurrency } from '../../lib/currency';

const GOLD = '#d4af37';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Payment Summary Tab ───────────────────────────────────────────────────────
const PaymentSummaryTab = () => {
  const [month, setMonth] = useState(getCurrentMonth());
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const { fetchPaymentSummary, markPaid } = useSalaries();
  const { expenses } = useExpenses();

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await fetchPaymentSummary(month);
      setSummary(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, [month]);

  const totals = useMemo(() => ({
    baseSalary: summary.reduce((s, e) => s + parseFloat(e.net_salary || 0), 0),
    expenses: summary.reduce((s, e) => s + parseFloat(e.total_expenses || 0), 0),
    advances: summary.reduce((s, e) => s + parseFloat(e.total_advance || 0), 0),
    finalPayment: summary.reduce((s, e) => s + parseFloat(e.final_payment || 0), 0),
  }), [summary]);

  const handleMarkPaid = async (emp) => {
    Alert.alert('Mark Salary Paid', `Mark salary for ${emp.employee_name} as paid for ${month}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid',
        onPress: async () => {
          try {
            await markPaid(emp.employee_id, month, emp.final_payment, null);
            await fetchSummary();
          } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.monthRow}>
        <Text style={styles.label}>Month</Text>
        <TextInput style={[styles.input, { flex: 1 }]} value={month} onChangeText={setMonth} placeholder="YYYY-MM" />
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSummary}>
          <Ionicons name="refresh-outline" size={18} color={GOLD} />
        </TouchableOpacity>
      </View>

      {/* Totals */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={styles.statValue}>{formatCurrency(totals.baseSalary)}</Text>
            <Text style={styles.statLabel}>Total Salaries</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.statValue}>{formatCurrency(totals.expenses)}</Text>
            <Text style={styles.statLabel}>Total Expenses</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.statValue}>{formatCurrency(totals.advances)}</Text>
            <Text style={styles.statLabel}>Total Advances</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: GOLD }]}>
            <Text style={styles.statValue}>{formatCurrency(totals.finalPayment)}</Text>
            <Text style={styles.statLabel}>Total to Pay</Text>
          </View>
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 20 }} />
      ) : summary.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cash-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No payment data for this month</Text>
        </View>
      ) : (
        summary.map((emp) => (
          <View key={emp.employee_id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.empName}>{emp.employee_name}</Text>
                <Text style={styles.empEmail}>{emp.employee_email}</Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: emp.payment_status === 'paid' ? '#d1fae5' : '#fef3c7',
              }]}>
                <Text style={[styles.statusBadgeText, {
                  color: emp.payment_status === 'paid' ? '#065f46' : '#92400e',
                }]}>{emp.payment_status || 'pending'}</Text>
              </View>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Base Salary</Text>
              <Text style={styles.payValue}>{formatCurrency(emp.net_salary)}</Text>
            </View>
            {parseFloat(emp.total_expenses) > 0 && (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>Expenses ({emp.expense_count})</Text>
                <Text style={[styles.payValue, { color: '#10b981' }]}>+{formatCurrency(emp.total_expenses)}</Text>
              </View>
            )}
            {parseFloat(emp.total_advance) > 0 && (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>Advances ({emp.advance_count})</Text>
                <Text style={[styles.payValue, { color: '#f59e0b' }]}>-{formatCurrency(emp.total_advance)}</Text>
              </View>
            )}
            <View style={[styles.payRow, styles.finalPayRow]}>
              <Text style={styles.finalPayLabel}>Final Payment</Text>
              <Text style={styles.finalPayValue}>{formatCurrency(emp.final_payment)}</Text>
            </View>
            {emp.payment_status !== 'paid' && (
              <TouchableOpacity style={styles.markPaidBtn} onPress={() => handleMarkPaid(emp)}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                <Text style={styles.markPaidBtnText}>Mark Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ─── Income Tab ────────────────────────────────────────────────────────────────
const IncomeTab = () => {
  const { incomeEntries, monthlySummary, loading, createIncome, updateIncome, deleteIncome, fetchMonthlySummary } = useIncome();
  const [month, setMonth] = useState(getCurrentMonth());
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', income_date: '', category: '', description: '' });

  useEffect(() => { fetchMonthlySummary(month); }, [month]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || !form.income_date) {
      Alert.alert('Validation', 'Title, amount, and date are required.');
      return;
    }
    try {
      setSubmitting(true);
      await createIncome({ title: form.title, amount: parseFloat(form.amount), income_date: form.income_date, category: form.category || null, description: form.description || null });
      setForm({ title: '', amount: '', income_date: '', category: '', description: '' });
      setShowModal(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Income', 'Delete this income entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteIncome(id); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Monthly Summary */}
      <View style={styles.monthRow}>
        <Text style={styles.label}>Month</Text>
        <TextInput style={[styles.input, { flex: 1 }]} value={month} onChangeText={setMonth} placeholder="YYYY-MM" />
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchMonthlySummary(month)}>
          <Ionicons name="refresh-outline" size={18} color={GOLD} />
        </TouchableOpacity>
      </View>

      {monthlySummary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
              <Text style={styles.statValue}>{formatCurrency(monthlySummary.summary?.total_income || 0)}</Text>
              <Text style={styles.statLabel}>Total Income</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
              <Text style={styles.statValue}>{formatCurrency(monthlySummary.summary?.total_expenses || 0)}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
              <Text style={styles.statValue}>{formatCurrency(monthlySummary.summary?.total_salaries || 0)}</Text>
              <Text style={styles.statLabel}>Total Salaries</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: monthlySummary.summary?.net_income >= 0 ? GOLD : '#ef4444' }]}>
              <Text style={[styles.statValue, { color: monthlySummary.summary?.net_income >= 0 ? '#10b981' : '#ef4444' }]}>
                {formatCurrency(monthlySummary.summary?.net_income || 0)}
              </Text>
              <Text style={styles.statLabel}>Net Income</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Income Entries</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Income</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} />
      ) : incomeEntries.length === 0 ? (
        <View style={styles.empty}><Ionicons name="trending-up-outline" size={40} color="#d1d5db" /><Text style={styles.emptyText}>No income entries</Text></View>
      ) : (
        incomeEntries.map((inc) => (
          <View key={inc.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.empName}>{inc.title}</Text>
                {inc.category && <Text style={styles.empEmail}>{inc.category}</Text>}
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.incomeAmount}>{formatCurrency(inc.amount)}</Text>
                <TouchableOpacity onPress={() => handleDelete(inc.id)} style={{ marginTop: 4 }}>
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            {inc.description && <Text style={styles.incomeDesc}>{inc.description}</Text>}
            <Text style={styles.incomeDate}>{formatDateOnly(inc.income_date)}</Text>
          </View>
        ))
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Income</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
              </View>
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="Income title" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              <Text style={styles.label}>Amount (Rs) *</Text>
              <TextInput style={styles.input} placeholder="0.00" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
              <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 2026-03-01" value={form.income_date} onChangeText={(v) => setForm({ ...form, income_date: v })} />
              <Text style={styles.label}>Category</Text>
              <TextInput style={styles.input} placeholder="e.g. Services" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} />
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Description..." value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Add Income</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ─── Expenses Admin Tab ────────────────────────────────────────────────────────
const ExpensesAdminTab = () => {
  const { expenses, categories, loading, createExpense, deleteExpense, markPaid } = useExpenses();
  const { profiles } = useProfiles();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = expenses;
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.description?.toLowerCase().includes(q) || e.employee_name?.toLowerCase().includes(q));
    }
    return list;
  }, [expenses, statusFilter, search]);

  const stats = useMemo(() => ({
    total: expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    approved: expenses.filter((e) => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    paid: expenses.filter((e) => e.status === 'paid').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    office: expenses.filter((e) => !e.employee_id).reduce((s, e) => s + parseFloat(e.amount || 0), 0),
  }), [expenses]);

  const handleMarkPaid = (id) => {
    Alert.alert('Mark Paid', 'Mark this expense as paid?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: async () => { try { await markPaid(id); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#6b7280' }]}><Text style={styles.statValue}>{formatCurrency(stats.total)}</Text><Text style={styles.statLabel}>Total</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}><Text style={styles.statValue}>{formatCurrency(stats.approved)}</Text><Text style={styles.statLabel}>Approved</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}><Text style={styles.statValue}>{formatCurrency(stats.paid)}</Text><Text style={styles.statLabel}>Paid</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#8b5cf6' }]}><Text style={styles.statValue}>{formatCurrency(stats.office)}</Text><Text style={styles.statLabel}>Office</Text></View>
        </View>
      </ScrollView>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={14} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput style={styles.searchInput} placeholder="Search..." value={search} onChangeText={setSearch} placeholderTextColor="#9ca3af" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.filterRow}>
          {['all', 'approved', 'paid', 'rejected'].map((s) => (
            <TouchableOpacity key={s} style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]} onPress={() => setStatusFilter(s)}>
              <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? <ActivityIndicator size="large" color={GOLD} /> : filtered.map((exp) => (
        <View key={exp.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.empName}>{formatCurrency(exp.amount)}</Text>
              <Text style={styles.empEmail}>{exp.employee_name || 'Office Expense'} · {exp.category_name || 'Uncategorized'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: exp.status === 'paid' ? '#d1fae5' : exp.status === 'approved' ? '#fef3c7' : '#fee2e2' }]}>
              <Text style={[styles.statusBadgeText, { color: exp.status === 'paid' ? '#065f46' : exp.status === 'approved' ? '#92400e' : '#991b1b' }]}>{exp.status}</Text>
            </View>
          </View>
          <Text style={styles.incomeDesc}>{exp.description}</Text>
          <View style={styles.cardFooterRow}>
            <Text style={styles.incomeDate}>{formatDateOnly(exp.expense_date)}</Text>
            {exp.status === 'approved' && (
              <TouchableOpacity style={styles.smallBtn} onPress={() => handleMarkPaid(exp.id)}>
                <Text style={styles.smallBtnText}>Mark Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ─── Categories Tab ────────────────────────────────────────────────────────────
const CategoriesTab = () => {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useExpenseCategories();
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const openCreate = () => { setEditingCat(null); setForm({ name: '', description: '', is_active: true }); setShowModal(true); };
  const openEdit = (cat) => { setEditingCat(cat); setForm({ name: cat.name, description: cat.description || '', is_active: cat.is_active !== false }); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    try {
      setSubmitting(true);
      if (editingCat) { await updateCategory(editingCat.id, form); } else { await createCategory(form); }
      setShowModal(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Category', 'Delete this category?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteCategory(id); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.addBtn, { alignSelf: 'flex-start', marginBottom: 12 }]} onPress={openCreate}>
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={styles.addBtnText}>Add Category</Text>
      </TouchableOpacity>

      {loading ? <ActivityIndicator size="large" color={GOLD} /> : categories.map((cat) => (
        <View key={cat.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.empName}>{cat.name}</Text>
              {cat.description && <Text style={styles.empEmail}>{cat.description}</Text>}
            </View>
            <View style={styles.cardActions}>
              <View style={[styles.statusBadge, { backgroundColor: cat.is_active ? '#d1fae5' : '#f3f4f6' }]}>
                <Text style={[styles.statusBadgeText, { color: cat.is_active ? '#065f46' : '#6b7280' }]}>{cat.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(cat)} style={{ padding: 4 }}>
                <Ionicons name="pencil-outline" size={16} color={GOLD} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(cat.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCat ? 'Edit Category' : 'Add Category'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} placeholder="Category name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description..." value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ false: '#d1d5db', true: '#10b981' }} thumbColor="#fff" />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>{editingCat ? 'Save' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ─── Salaries Tab ──────────────────────────────────────────────────────────────
const SalariesTab = () => {
  const { salaries, loading, createSalary, updateSalary, deleteSalary } = useSalaries();
  const { profiles } = useProfiles();
  const [showModal, setShowModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ employee_id: '', base_salary: '', allowances: '0', deductions: '0', effective_from: '', effective_to: '', notes: '' });

  const employeesWithoutSalary = useMemo(() => {
    const withSalary = new Set(salaries.filter((s) => s.is_active).map((s) => s.employee_id));
    return profiles.filter((p) => p.is_active && !withSalary.has(p.id));
  }, [profiles, salaries]);

  const openCreate = () => { setEditingSalary(null); setForm({ employee_id: '', base_salary: '', allowances: '0', deductions: '0', effective_from: '', effective_to: '', notes: '' }); setShowModal(true); };
  const openEdit = (sal) => {
    setEditingSalary(sal);
    setForm({ employee_id: sal.employee_id, base_salary: sal.base_salary?.toString(), allowances: sal.allowances?.toString() || '0', deductions: sal.deductions?.toString() || '0', effective_from: sal.effective_from?.split('T')[0] || '', effective_to: sal.effective_to?.split('T')[0] || '', notes: sal.notes || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.employee_id && !editingSalary) { Alert.alert('Validation', 'Select an employee.'); return; }
    if (!form.base_salary) { Alert.alert('Validation', 'Base salary is required.'); return; }
    try {
      setSubmitting(true);
      const data = { employee_id: form.employee_id, base_salary: parseFloat(form.base_salary), allowances: parseFloat(form.allowances) || 0, deductions: parseFloat(form.deductions) || 0, effective_from: form.effective_from || null, effective_to: form.effective_to || null, notes: form.notes || null };
      if (editingSalary) { await updateSalary(editingSalary.id, data); } else { await createSalary(data); }
      setShowModal(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Salary', 'Delete this salary record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteSalary(id); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.addBtn, { alignSelf: 'flex-start', marginBottom: 12 }]} onPress={openCreate}>
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={styles.addBtnText}>Add Salary</Text>
      </TouchableOpacity>

      {loading ? <ActivityIndicator size="large" color={GOLD} /> : salaries.map((sal) => (
        <View key={sal.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.empName}>{sal.employee_name || 'Employee'}</Text>
              <Text style={styles.empEmail}>Net: {formatCurrency(sal.net_salary)}</Text>
            </View>
            <View style={styles.cardActions}>
              <View style={[styles.statusBadge, { backgroundColor: sal.is_active ? '#d1fae5' : '#f3f4f6' }]}>
                <Text style={[styles.statusBadgeText, { color: sal.is_active ? '#065f46' : '#6b7280' }]}>{sal.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(sal)} style={{ padding: 4 }}><Ionicons name="pencil-outline" size={16} color={GOLD} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(sal.id)} style={{ padding: 4 }}><Ionicons name="trash-outline" size={16} color="#ef4444" /></TouchableOpacity>
            </View>
          </View>
          <View style={styles.salaryBreakdown}>
            <Text style={styles.breakdownItem}>Base: {formatCurrency(sal.base_salary)}</Text>
            <Text style={[styles.breakdownItem, { color: '#10b981' }]}>+{formatCurrency(sal.allowances)}</Text>
            <Text style={[styles.breakdownItem, { color: '#ef4444' }]}>-{formatCurrency(sal.deductions)}</Text>
          </View>
          {sal.effective_from && <Text style={styles.incomeDate}>From {formatDateOnly(sal.effective_from)}{sal.effective_to ? ` to ${formatDateOnly(sal.effective_to)}` : ''}</Text>}
        </View>
      ))}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingSalary ? 'Edit Salary' : 'Add Salary'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
              </View>
              {!editingSalary && (
                <>
                  <Text style={styles.label}>Employee *</Text>
                  <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator>
                    {employeesWithoutSalary.map((emp) => (
                      <TouchableOpacity key={emp.id} style={[styles.selectOption, form.employee_id === emp.id && styles.selectOptionActive]} onPress={() => setForm({ ...form, employee_id: emp.id })}>
                        <Ionicons name={form.employee_id === emp.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={form.employee_id === emp.id ? GOLD : '#9ca3af'} />
                        <Text style={styles.selectOptionText}>{emp.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={styles.label}>Base Salary (Rs) *</Text>
              <TextInput style={styles.input} placeholder="0.00" value={form.base_salary} onChangeText={(v) => setForm({ ...form, base_salary: v })} keyboardType="decimal-pad" />
              <Text style={styles.label}>Allowances (Rs)</Text>
              <TextInput style={styles.input} placeholder="0.00" value={form.allowances} onChangeText={(v) => setForm({ ...form, allowances: v })} keyboardType="decimal-pad" />
              <Text style={styles.label}>Deductions (Rs)</Text>
              <TextInput style={styles.input} placeholder="0.00" value={form.deductions} onChangeText={(v) => setForm({ ...form, deductions: v })} keyboardType="decimal-pad" />
              <Text style={styles.label}>Effective From (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="e.g. 2026-01-01" value={form.effective_from} onChangeText={(v) => setForm({ ...form, effective_from: v })} />
              <Text style={styles.label}>Effective To (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="Leave blank for ongoing" value={form.effective_to} onChangeText={(v) => setForm({ ...form, effective_to: v })} />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Notes..." value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline numberOfLines={2} />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>{editingSalary ? 'Save' : 'Create'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ─── Advance Salaries Admin Tab ────────────────────────────────────────────────
const AdvanceSalariesAdminTab = () => {
  const { advances, loading, updateStatus } = useAdvanceSalaries();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAdv, setSelectedAdv] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const filtered = useMemo(() => {
    let list = advances;
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) list = list.filter((a) => a.employee_name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [advances, statusFilter, search]);

  const stats = useMemo(() => ({
    pending: advances.filter((a) => a.status === 'pending').length,
    pendingAmount: advances.filter((a) => a.status === 'pending').reduce((s, a) => s + parseFloat(a.amount || 0), 0),
    paidAmount: advances.filter((a) => a.status === 'paid').reduce((s, a) => s + parseFloat(a.amount || 0), 0),
  }), [advances]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}><Text style={styles.statValue}>{stats.pending}</Text><Text style={styles.statLabel}>Pending</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}><Text style={styles.statValue}>{formatCurrency(stats.pendingAmount)}</Text><Text style={styles.statLabel}>Pending Amt</Text></View>
          <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}><Text style={styles.statValue}>{formatCurrency(stats.paidAmount)}</Text><Text style={styles.statLabel}>Paid Amt</Text></View>
        </View>
      </ScrollView>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={14} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput style={styles.searchInput} placeholder="Search employee..." value={search} onChangeText={setSearch} placeholderTextColor="#9ca3af" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.filterRow}>
          {['all', 'pending', 'approved', 'paid', 'rejected'].map((s) => (
            <TouchableOpacity key={s} style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]} onPress={() => setStatusFilter(s)}>
              <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? <ActivityIndicator size="large" color={GOLD} /> : filtered.map((adv) => (
        <View key={adv.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.empName}>{adv.employee_name}</Text>
              <Text style={styles.empEmail}>{formatCurrency(adv.amount)} · {formatDateOnly(adv.request_date)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: adv.status === 'paid' ? '#d1fae5' : adv.status === 'approved' ? '#eff6ff' : adv.status === 'rejected' ? '#fee2e2' : '#fef3c7' }]}>
              <Text style={[styles.statusBadgeText, { color: adv.status === 'paid' ? '#065f46' : adv.status === 'approved' ? '#1d4ed8' : adv.status === 'rejected' ? '#991b1b' : '#92400e' }]}>{adv.status}</Text>
            </View>
          </View>
          <Text style={styles.incomeDesc}>{adv.reason}</Text>
          <View style={styles.cardFooterRow}>
            {adv.status === 'pending' && (
              <>
                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#10b981' }]} onPress={async () => { try { await updateStatus(adv.id, 'approved', null, null); } catch (e) { Alert.alert('Error', e.message); } }}>
                  <Text style={[styles.smallBtnText, { color: '#fff' }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#ef4444' }]} onPress={() => { setSelectedAdv(adv); setRejectionReason(''); setShowRejectModal(true); }}>
                  <Text style={[styles.smallBtnText, { color: '#fff' }]}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {adv.status === 'approved' && (
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#3b82f6' }]} onPress={async () => { try { await updateStatus(adv.id, 'paid', null, null); } catch (e) { Alert.alert('Error', e.message); } }}>
                <Text style={[styles.smallBtnText, { color: '#fff' }]}>Mark Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      <Modal visible={showRejectModal} transparent animationType="slide" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Advance</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Rejection Reason *</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Reason..." value={rejectionReason} onChangeText={setRejectionReason} multiline numberOfLines={3} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRejectModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#ef4444' }]} onPress={async () => {
                if (!rejectionReason.trim()) { Alert.alert('Validation', 'Reason required.'); return; }
                try { await updateStatus(selectedAdv.id, 'rejected', rejectionReason, null); setShowRejectModal(false); } catch (e) { Alert.alert('Error', e.message); }
              }}>
                <Text style={styles.submitBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ─── Main FinancialManagement Component ───────────────────────────────────────
const FinancialManagement = () => {
  const [activeTab, setActiveTab] = useState('payment');

  const tabs = [
    { key: 'payment', label: 'Payment', icon: 'calculator-outline' },
    { key: 'income', label: 'Income', icon: 'trending-up-outline' },
    { key: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
    { key: 'categories', label: 'Categories', icon: 'pricetag-outline' },
    { key: 'salaries', label: 'Salaries', icon: 'cash-outline' },
    { key: 'advances', label: 'Advances', icon: 'arrow-down-circle-outline' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={13} color={activeTab === tab.key ? '#fff' : '#6b7280'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'payment' && <PaymentSummaryTab />}
        {activeTab === 'income' && <IncomeTab />}
        {activeTab === 'expenses' && <ExpensesAdminTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'salaries' && <SalariesTab />}
        {activeTab === 'advances' && <AdvanceSalariesAdminTab />}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabsScroll: { flexGrow: 0, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  activeTab: { backgroundColor: GOLD, borderColor: GOLD },
  tabText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  tabContent: { flex: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, minWidth: 110, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardRight: { alignItems: 'flex-end' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  empEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  payLabel: { fontSize: 13, color: '#374151' },
  payValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  finalPayRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 4, paddingTop: 8 },
  finalPayLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  finalPayValue: { fontSize: 14, fontWeight: '700', color: GOLD },
  markPaidBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 8, alignSelf: 'flex-end',
  },
  markPaidBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  incomeAmount: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  incomeDesc: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  incomeDate: { fontSize: 11, color: '#9ca3af' },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  smallBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  smallBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterBtnText: { fontSize: 12, color: '#374151' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  salaryBreakdown: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  breakdownItem: { fontSize: 12, color: '#374151' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  refreshBtn: { padding: 8 },
  selectOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 6, backgroundColor: '#f9fafb',
  },
  selectOptionActive: { borderColor: GOLD, backgroundColor: '#fffbeb' },
  selectOptionText: { fontSize: 14, color: '#374151', flex: 1 },
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
  textArea: { height: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 4 },
  switchLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default FinancialManagement;
