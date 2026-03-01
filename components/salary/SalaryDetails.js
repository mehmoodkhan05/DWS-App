import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSalaries } from '../../hooks/useSalaries';
import { formatDateOnly } from '../../lib/utils';
import { formatCurrency } from '../../lib/currency';

const GOLD = '#d4af37';

const SalaryRow = ({ label, value, color, icon, bold }) => (
  <View style={styles.salaryRow}>
    <View style={styles.salaryRowLeft}>
      {icon && <Ionicons name={icon} size={14} color={color || '#6b7280'} style={{ marginRight: 6 }} />}
      <Text style={[styles.salaryRowLabel, bold && { fontWeight: '700' }]}>{label}</Text>
    </View>
    <Text style={[styles.salaryRowValue, { color: color || '#111827' }, bold && { fontWeight: '700' }]}>
      {value}
    </Text>
  </View>
);

const SalaryDetails = () => {
  const { user } = useAuth();
  const { currentSalary: fetchedCurrent, salaries, loading, fetchCurrentSalary } = useSalaries(user?.id);

  // Fall back to the most recent salary from getAll() if getCurrent() returns nothing
  // (handles cases where effective_from is in future or is_active flag mismatch)
  const currentSalary = fetchedCurrent || (
    salaries
      .filter((s) => s.employee_id === user?.id)
      .sort((a, b) => {
        // Prefer active ones first, then most recent
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return new Date(b.effective_from) - new Date(a.effective_from);
      })[0] || null
  );

  useEffect(() => {
    if (user?.id) fetchCurrentSalary(user.id);
  }, [user?.id]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  if (!currentSalary) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cash-outline" size={48} color="#d1d5db" />
        <Text style={styles.noSalaryTitle}>No Salary Record</Text>
        <Text style={styles.noSalaryText}>No salary information has been set up for your account yet.</Text>
      </View>
    );
  }

  const base = parseFloat(currentSalary.base_salary || 0);
  const allowances = parseFloat(currentSalary.allowances || 0);
  const deductions = parseFloat(currentSalary.deductions || 0);
  const netSalary = parseFloat(currentSalary.net_salary || base + allowances - deductions);
  const totalExpenses = parseFloat(currentSalary.total_expenses || 0);
  const totalAdvance = parseFloat(currentSalary.total_advance || 0);
  const finalSalary = netSalary + totalExpenses - totalAdvance;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Current Salary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="cash-outline" size={20} color={GOLD} />
            <Text style={styles.cardTitle}>Current Salary</Text>
          </View>
          {!!currentSalary.is_active && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>

        <View style={styles.finalSalaryBox}>
          <Text style={styles.finalSalaryLabel}>Final Monthly Payment</Text>
          <Text style={styles.finalSalaryValue}>{formatCurrency(finalSalary)}</Text>
        </View>

        <View style={styles.divider} />

        <SalaryRow label="Base Salary" value={formatCurrency(base)} icon="wallet-outline" />
        {allowances > 0 && (
          <SalaryRow label="Allowances" value={`+ ${formatCurrency(allowances)}`} color="#10b981" icon="add-circle-outline" />
        )}
        {deductions > 0 && (
          <SalaryRow label="Deductions" value={`- ${formatCurrency(deductions)}`} color="#ef4444" icon="remove-circle-outline" />
        )}
        <SalaryRow label="Net Salary" value={formatCurrency(netSalary)} bold />

        {totalExpenses > 0 && (
          <SalaryRow label="Expense Reimbursement" value={`+ ${formatCurrency(totalExpenses)}`} color="#10b981" icon="receipt-outline" />
        )}
        {totalAdvance > 0 && (
          <SalaryRow label="Advance Deduction" value={`- ${formatCurrency(totalAdvance)}`} color="#f59e0b" icon="arrow-down-circle-outline" />
        )}

        <View style={styles.divider} />
        <SalaryRow label="Final Payment" value={formatCurrency(finalSalary)} bold color={GOLD} />

        {(currentSalary.effective_from || currentSalary.effective_to) && (
          <View style={styles.datesRow}>
            {currentSalary.effective_from && (
              <Text style={styles.dateText}>From: {formatDateOnly(currentSalary.effective_from)}</Text>
            )}
            {currentSalary.effective_to && (
              <Text style={styles.dateText}>To: {formatDateOnly(currentSalary.effective_to)}</Text>
            )}
          </View>
        )}

        {currentSalary.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{currentSalary.notes}</Text>
          </View>
        )}
      </View>

      {/* Salary Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Salary Breakdown</Text>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownItem, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.breakdownLabel}>Base</Text>
            <Text style={[styles.breakdownValue, { color: '#1d4ed8' }]}>{formatCurrency(base)}</Text>
          </View>
          <View style={[styles.breakdownItem, { backgroundColor: '#f0fdf4' }]}>
            <Text style={styles.breakdownLabel}>Allowances</Text>
            <Text style={[styles.breakdownValue, { color: '#10b981' }]}>+{formatCurrency(allowances)}</Text>
          </View>
          <View style={[styles.breakdownItem, { backgroundColor: '#fef2f2' }]}>
            <Text style={styles.breakdownLabel}>Deductions</Text>
            <Text style={[styles.breakdownValue, { color: '#ef4444' }]}>-{formatCurrency(deductions)}</Text>
          </View>
        </View>
        <View style={styles.formulaBox}>
          <Text style={styles.formulaText}>
            Net = Base ({formatCurrency(base)}) + Allowances ({formatCurrency(allowances)}) - Deductions ({formatCurrency(deductions)}) = {formatCurrency(netSalary)}
          </Text>
          {(totalExpenses > 0 || totalAdvance > 0) && (
            <Text style={styles.formulaText}>
              Final = Net ({formatCurrency(netSalary)}) + Expenses ({formatCurrency(totalExpenses)}) - Advances ({formatCurrency(totalAdvance)}) = {formatCurrency(finalSalary)}
            </Text>
          )}
        </View>
      </View>

      {/* Salary History */}
      {salaries.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Salary History</Text>
          {salaries
            .filter((s) => s.employee_id === user?.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((s) => (
              <View key={s.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyNet}>{formatCurrency(s.net_salary)}</Text>
                  <Text style={styles.historyDates}>
                    {formatDateOnly(s.effective_from)}
                    {s.effective_to ? ` → ${formatDateOnly(s.effective_to)}` : ' → Present'}
                  </Text>
                </View>
                <View style={[styles.historyStatus, s.is_active ? styles.historyActive : styles.historyInactive]}>
                  <Text style={[styles.historyStatusText, { color: s.is_active ? '#065f46' : '#6b7280' }]}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  noSalaryTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  noSalaryText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  activeBadge: { backgroundColor: '#d1fae5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontSize: 11, color: '#065f46', fontWeight: '600' },
  finalSalaryBox: {
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 14,
    alignItems: 'center', marginBottom: 14,
  },
  finalSalaryLabel: { fontSize: 12, color: '#92400e', marginBottom: 4 },
  finalSalaryValue: { fontSize: 28, fontWeight: '800', color: GOLD },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  salaryRowLeft: { flexDirection: 'row', alignItems: 'center' },
  salaryRowLabel: { fontSize: 14, color: '#374151' },
  salaryRowValue: { fontSize: 14, fontWeight: '600' },
  datesRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  dateText: { fontSize: 12, color: '#9ca3af' },
  notesBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 10 },
  notesLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  notesText: { fontSize: 13, color: '#374151' },
  breakdownRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 10 },
  breakdownItem: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  breakdownLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  formulaBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, gap: 4 },
  formulaText: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  historyNet: { fontSize: 15, fontWeight: '700', color: '#111827' },
  historyDates: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  historyStatus: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  historyActive: { backgroundColor: '#d1fae5' },
  historyInactive: { backgroundColor: '#f3f4f6' },
  historyStatusText: { fontSize: 11, fontWeight: '600' },
});

export default SalaryDetails;
