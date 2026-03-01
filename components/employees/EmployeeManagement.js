import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfiles } from '../../hooks/useProfiles';
import { formatDateOnly } from '../../lib/utils';

const GOLD = '#d4af37';
const ROLES = ['employee', 'manager', 'admin'];
const ROLE_COLORS = {
  admin: { bg: '#fef3c7', text: '#92400e' },
  manager: { bg: '#eff6ff', text: '#1d4ed8' },
  employee: { bg: '#f0fdf4', text: '#166534' },
};

const Avatar = ({ name, size = 40 }) => {
  const initials = name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
};

const StatCard = ({ label, value, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const EmployeeManagement = () => {
  const { profiles, loading, createProfile, updateProfile, toggleActiveStatus, deleteProfile } = useProfiles();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', role: 'employee', employee_id: '',
    password: '', department: '', phone: '', hire_date: '', is_active: true,
  });

  const stats = useMemo(() => ({
    active: profiles.filter((p) => p.is_active).length,
    inactive: profiles.filter((p) => !p.is_active).length,
    admins: profiles.filter((p) => p.role === 'admin').length,
    managers: profiles.filter((p) => p.role === 'manager').length,
    employees: profiles.filter((p) => p.role === 'employee').length,
  }), [profiles]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.employee_id?.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'all') list = list.filter((p) => p.role === roleFilter);
    return list;
  }, [profiles, search, roleFilter]);

  const openCreate = () => {
    setEditingEmployee(null);
    setForm({ full_name: '', email: '', role: 'employee', employee_id: '', password: '', department: '', phone: '', hire_date: '', is_active: true });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setForm({
      full_name: emp.full_name || '',
      email: emp.email || '',
      role: emp.role || 'employee',
      employee_id: emp.employee_id || '',
      password: '',
      department: emp.department || '',
      phone: emp.phone || '',
      hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      is_active: emp.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { Alert.alert('Validation', 'Full name is required.'); return; }
    if (!form.email.trim()) { Alert.alert('Validation', 'Email is required.'); return; }
    if (!editingEmployee && !form.password.trim()) { Alert.alert('Validation', 'Password is required for new employees.'); return; }
    try {
      setSubmitting(true);
      const data = { ...form };
      if (!data.password) delete data.password;
      if (editingEmployee) {
        await updateProfile(editingEmployee.id, data);
      } else {
        await createProfile(data);
      }
      setShowModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = (emp) => {
    const action = emp.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Employee`,
      `Are you sure you want to ${action} ${emp.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try { await toggleActiveStatus(emp.id); } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const handleDelete = (emp) => {
    if (emp.is_active) {
      Alert.alert('Cannot Delete', 'Please deactivate the employee before deleting.');
      return;
    }
    Alert.alert(
      'Delete Employee',
      `Are you sure you want to permanently delete ${emp.full_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { await deleteProfile(emp.id); } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={styles.statsRow}>
          <StatCard label="Active" value={stats.active} color="#10b981" />
          <StatCard label="Inactive" value={stats.inactive} color="#ef4444" />
          <StatCard label="Admins" value={stats.admins} color={GOLD} />
          <StatCard label="Managers" value={stats.managers} color="#3b82f6" />
          <StatCard label="Employees" value={stats.employees} color="#8b5cf6" />
        </View>
      </ScrollView>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Employees ({filtered.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or ID..."
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

      {/* Role Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {['all', ...ROLES].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.filterBtn, roleFilter === r && styles.filterBtnActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.filterBtnText, roleFilter === r && styles.filterBtnTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Employee Cards */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No employees found</Text>
        </View>
      ) : (
        filtered.map((emp) => {
          const roleColors = ROLE_COLORS[emp.role] || ROLE_COLORS.employee;
          return (
            <View key={emp.id} style={[styles.empCard, !emp.is_active ? styles.inactiveCard : null]}>
              <View style={styles.empCardHeader}>
                <Avatar name={emp.full_name} />
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{emp.full_name}</Text>
                  {emp.employee_id && (
                    <Text style={styles.empId}>ID: {emp.employee_id}</Text>
                  )}
                  <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColors.text }]}>{emp.role}</Text>
                  </View>
                </View>
                <View style={[styles.statusDot, { backgroundColor: !!emp.is_active ? '#10b981' : '#ef4444' }]} />
              </View>

              <View style={styles.empDetails}>
                {emp.email && (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={13} color="#9ca3af" />
                    <Text style={styles.detailText}>{emp.email}</Text>
                  </View>
                )}
                {emp.phone && (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={13} color="#9ca3af" />
                    <Text style={styles.detailText}>{emp.phone}</Text>
                  </View>
                )}
                {emp.department && (
                  <View style={styles.detailRow}>
                    <Ionicons name="business-outline" size={13} color="#9ca3af" />
                    <Text style={styles.detailText}>{emp.department}</Text>
                  </View>
                )}
                {emp.hire_date && (
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
                    <Text style={styles.detailText}>Hired {formatDateOnly(emp.hire_date)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.empActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(emp)}>
                  <Ionicons name="pencil-outline" size={14} color={GOLD} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !!emp.is_active ? styles.deactivateBtn : styles.activateBtn]}
                  onPress={() => handleToggleActive(emp)}
                >
                  <Ionicons name={!!emp.is_active ? 'person-remove-outline' : 'person-add-outline'} size={14} color="#fff" />
                  <Text style={styles.toggleBtnText}>{!!emp.is_active ? 'Deactivate' : 'Activate'}</Text>
                </TouchableOpacity>
                {!emp.is_active && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(emp)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="Full name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />

              <Text style={styles.label}>Email *</Text>
              <TextInput style={styles.input} placeholder="Email address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>{editingEmployee ? 'New Password (leave blank to keep)' : 'Password *'}</Text>
              <TextInput style={styles.input} placeholder={editingEmployee ? 'Leave blank to keep current' : 'Password'} value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry />

              <Text style={styles.label}>Role</Text>
              <View style={styles.optionsRow}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.optionBtn, form.role === r && styles.optionBtnActive]}
                    onPress={() => setForm({ ...form, role: r })}
                  >
                    <Text style={[styles.optionBtnText, form.role === r && styles.optionBtnTextActive]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Employee ID</Text>
              <TextInput style={styles.input} placeholder="e.g. EMP001" value={form.employee_id} onChangeText={(v) => setForm({ ...form, employee_id: v })} />

              <Text style={styles.label}>Department</Text>
              <TextInput style={styles.input} placeholder="e.g. Security" value={form.department} onChangeText={(v) => setForm({ ...form, department: v })} />

              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} placeholder="Phone number" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />

              <Text style={styles.label}>Hire Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="e.g. 2024-01-15" value={form.hire_date} onChangeText={(v) => setForm({ ...form, hire_date: v })} />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>{editingEmployee ? 'Save Changes' : 'Create Employee'}</Text>
                  )}
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
  statsScroll: { marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, minWidth: 80, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filterScroll: { marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterBtnText: { fontSize: 13, color: '#374151' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  empCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  inactiveCard: { opacity: 0.7 },
  empCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatar: { backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700' },
  empInfo: { flex: 1 },
  empName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  empId: { fontSize: 11, color: '#9ca3af', marginBottom: 4 },
  roleBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: 11, fontWeight: '600' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  empDetails: { marginBottom: 10, gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#6b7280', flex: 1 },
  empActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: GOLD, backgroundColor: '#fffbeb',
  },
  editBtnText: { fontSize: 12, color: GOLD, fontWeight: '600' },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flex: 1,
    justifyContent: 'center',
  },
  deactivateBtn: { backgroundColor: '#f59e0b' },
  activateBtn: { backgroundColor: '#10b981' },
  toggleBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  deleteBtn: { padding: 6 },
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
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
    backgroundColor: '#f9fafb',
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  optionBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  optionBtnText: { fontSize: 13, color: '#374151' },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default EmployeeManagement;
