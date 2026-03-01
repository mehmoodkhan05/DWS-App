import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../contexts/AuthContext';
import { useRotas } from '../../hooks/useRotas';
import { useProfiles } from '../../hooks/useProfiles';
import { formatDateOnly } from '../../lib/utils';

const GOLD = '#d4af37';
const SHIFT_TYPE_COLORS = { day: '#fbbf24', night: '#1e293b', off: '#9ca3af' };

const StatCard = ({ label, value, icon, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={18} color={color} style={{ marginBottom: 4 }} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const RotaManagement = () => {
  const { isAdmin, isManager } = useAuth();
  const { rotas, shiftPatterns, loading, createRota, updateRota, deleteRota, clearAllRotas, createShiftPattern, deleteShiftPattern } = useRotas();
  const { profiles } = useProfiles();

  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');

  // Assign shift modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', date: '', shift_pattern_id: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Shift pattern modal
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternForm, setPatternForm] = useState({ name: '', type: 'day', start_time: '', end_time: '', color: GOLD, description: '' });

  const today = new Date().toISOString().split('T')[0];
  const activeEmployees = profiles.filter((p) => p.is_active);

  const stats = useMemo(() => ({
    total: rotas.length,
    today: rotas.filter((r) => r.date === today).length,
    locked: rotas.filter((r) => r.is_locked).length,
    patterns: shiftPatterns.length,
  }), [rotas, shiftPatterns, today]);

  // Build marked dates for calendar (show all employees' shifts)
  const markedDates = useMemo(() => {
    const marks = {};
    rotas.forEach((r) => {
      if (!marks[r.date]) marks[r.date] = { dots: [] };
      const color = r.shift_pattern?.color || SHIFT_TYPE_COLORS[r.shift_pattern?.type] || GOLD;
      if (marks[r.date].dots.length < 3) {
        marks[r.date].dots.push({ color });
      }
    });
    if (selectedDate) {
      marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: GOLD };
    }
    return marks;
  }, [rotas, selectedDate]);

  const shiftsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    return rotas.filter((r) => r.date === selectedDate);
  }, [rotas, selectedDate]);

  const filteredRotas = useMemo(() => {
    let list = rotas;
    if (searchEmployee.trim()) {
      const q = searchEmployee.toLowerCase();
      list = list.filter((r) => r.employee_name?.toLowerCase().includes(q));
    }
    if (filterEmployee !== 'all') list = list.filter((r) => r.employee_id === filterEmployee);
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [rotas, searchEmployee, filterEmployee]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setAssignForm({ ...assignForm, date: day.dateString });
  };

  const handleAssignShift = async () => {
    if (!assignForm.employee_id) { Alert.alert('Validation', 'Please select an employee.'); return; }
    if (!assignForm.date) { Alert.alert('Validation', 'Please select a date.'); return; }
    if (!assignForm.shift_pattern_id) { Alert.alert('Validation', 'Please select a shift pattern.'); return; }
    try {
      setSubmitting(true);
      await createRota({
        employee_id: assignForm.employee_id,
        date: assignForm.date,
        shift_pattern_id: assignForm.shift_pattern_id,
        notes: assignForm.notes || null,
      });
      setShowAssignModal(false);
      setAssignForm({ employee_id: '', date: selectedDate || '', shift_pattern_id: '', notes: '' });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = (rota) => {
    Alert.alert(
      rota.is_locked ? 'Unlock Shift' : 'Lock Shift',
      `${rota.is_locked ? 'Unlock' : 'Lock'} this shift for ${rota.employee_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: rota.is_locked ? 'Unlock' : 'Lock',
          onPress: async () => {
            try { await updateRota(rota.id, { is_locked: !rota.is_locked }); } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const handleDeleteRota = (id) => {
    Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteRota(id); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Shifts', 'This will permanently delete ALL shift assignments. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          try { await clearAllRotas(); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleCreatePattern = async () => {
    if (!patternForm.name.trim()) { Alert.alert('Validation', 'Pattern name is required.'); return; }
    try {
      setSubmitting(true);
      await createShiftPattern(patternForm);
      setPatternForm({ name: '', type: 'day', start_time: '', end_time: '', color: GOLD, description: '' });
      setShowPatternModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePattern = (id) => {
    Alert.alert('Delete Pattern', 'Delete this shift pattern?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteShiftPattern(id); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.statsRow}>
          <StatCard label="Total Shifts" value={stats.total} icon="calendar-outline" color="#3b82f6" />
          <StatCard label="Today" value={stats.today} icon="today-outline" color={GOLD} />
          <StatCard label="Locked" value={stats.locked} icon="lock-closed-outline" color="#ef4444" />
          <StatCard label="Patterns" value={stats.patterns} icon="color-palette-outline" color="#8b5cf6" />
        </View>
      </ScrollView>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.tabs}>
          {[
            { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
            { key: 'assignments', label: 'Assignments', icon: 'list-outline' },
            { key: 'patterns', label: 'Patterns', icon: 'color-palette-outline' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? '#fff' : '#6b7280'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <View>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                selectedDayBackgroundColor: GOLD,
                todayTextColor: GOLD,
                arrowColor: GOLD,
                dotColor: GOLD,
              }}
            />

            <View style={styles.calendarActions}>
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => {
                  setAssignForm({ employee_id: '', date: selectedDate || today, shift_pattern_id: '', notes: '' });
                  setShowAssignModal(true);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.assignBtnText}>Assign Shift</Text>
              </TouchableOpacity>
            </View>

            {selectedDate && (
              <View style={styles.dayDetail}>
                <Text style={styles.dayDetailTitle}>Shifts on {formatDateOnly(selectedDate)}</Text>
                {shiftsOnDate.length === 0 ? (
                  <Text style={styles.emptyText}>No shifts assigned</Text>
                ) : (
                  shiftsOnDate.map((r) => (
                    <View key={r.id} style={styles.shiftChip}>
                      <View style={[styles.shiftDot, { backgroundColor: r.shift_pattern?.color || GOLD }]} />
                      <Text style={styles.shiftChipName}>{r.employee_name}</Text>
                      <Text style={styles.shiftChipPattern}>{r.shift_pattern?.name || 'Shift'}</Text>
                      {!!r.is_locked && <Ionicons name="lock-closed" size={12} color="#9ca3af" />}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <View>
            <View style={styles.assignHeader}>
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => {
                  setAssignForm({ employee_id: '', date: today, shift_pattern_id: '', notes: '' });
                  setShowAssignModal(true);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.assignBtnText}>Assign Shift</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={14} color="#9ca3af" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search employee..."
                value={searchEmployee}
                onChangeText={setSearchEmployee}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {filteredRotas.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>No shifts found</Text>
              </View>
            ) : (
              filteredRotas.map((rota) => (
                <View key={rota.id} style={[styles.rotaCard, !!rota.is_locked && styles.lockedCard]}>
                  <View style={styles.rotaCardHeader}>
                    <View>
                      <Text style={styles.rotaEmployee}>{rota.employee_name}</Text>
                      <Text style={styles.rotaDate}>{formatDateOnly(rota.date)}</Text>
                    </View>
                    <View style={styles.rotaRight}>
                      <View style={[styles.shiftBadge, { backgroundColor: (rota.shift_pattern?.color || GOLD) + '20' }]}>
                        <View style={[styles.shiftDot, { backgroundColor: rota.shift_pattern?.color || GOLD }]} />
                        <Text style={[styles.shiftBadgeText, { color: rota.shift_pattern?.color || GOLD }]}>
                          {rota.shift_pattern?.name || 'Shift'}
                        </Text>
                      </View>
                      {!!rota.is_locked && (
                        <View style={styles.lockedBadge}>
                          <Ionicons name="lock-closed" size={10} color="#6b7280" />
                          <Text style={styles.lockedBadgeText}>Locked</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {rota.shift_pattern?.start_time && (
                    <Text style={styles.rotaTime}>
                      {rota.shift_pattern.start_time} – {rota.shift_pattern.end_time}
                    </Text>
                  )}
                  {rota.notes && <Text style={styles.rotaNotes}>{rota.notes}</Text>}
                  <View style={styles.rotaActions}>
                    <TouchableOpacity style={styles.lockBtn} onPress={() => handleToggleLock(rota)}>
                      <Ionicons name={!!rota.is_locked ? 'lock-open-outline' : 'lock-closed-outline'} size={14} color="#6b7280" />
                      <Text style={styles.lockBtnText}>{!!rota.is_locked ? 'Unlock' : 'Lock'}</Text>
                    </TouchableOpacity>
                    {!rota.is_locked && (
                      <TouchableOpacity style={styles.deleteRotaBtn} onPress={() => handleDeleteRota(rota.id)}>
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <View>
            <TouchableOpacity style={[styles.assignBtn, { alignSelf: 'flex-start', marginBottom: 12 }]} onPress={() => setShowPatternModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.assignBtnText}>New Pattern</Text>
            </TouchableOpacity>

            {shiftPatterns.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="color-palette-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>No shift patterns</Text>
              </View>
            ) : (
              shiftPatterns.map((pattern) => (
                <View key={pattern.id} style={styles.patternCard}>
                  <View style={styles.patternHeader}>
                    <View style={[styles.colorSwatch, { backgroundColor: pattern.color || GOLD }]} />
                    <View style={styles.patternInfo}>
                      <Text style={styles.patternName}>{pattern.name}</Text>
                      <View style={styles.patternMeta}>
                        <View style={[styles.typeBadge, { backgroundColor: SHIFT_TYPE_COLORS[pattern.type] + '30' }]}>
                          <Text style={[styles.typeBadgeText, { color: SHIFT_TYPE_COLORS[pattern.type] }]}>{pattern.type}</Text>
                        </View>
                        {pattern.start_time && (
                          <Text style={styles.patternTime}>{pattern.start_time} – {pattern.end_time}</Text>
                        )}
                      </View>
                      {pattern.description && <Text style={styles.patternDesc}>{pattern.description}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePattern(pattern.id)}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Assign Shift Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Shift</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Employee *</Text>
              <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator>
                {activeEmployees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.selectOption, assignForm.employee_id === emp.id && styles.selectOptionActive]}
                    onPress={() => setAssignForm({ ...assignForm, employee_id: emp.id })}
                  >
                    <Ionicons
                      name={assignForm.employee_id === emp.id ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={assignForm.employee_id === emp.id ? GOLD : '#9ca3af'}
                    />
                    <Text style={styles.selectOptionText}>{emp.full_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-03-15"
                value={assignForm.date}
                onChangeText={(v) => setAssignForm({ ...assignForm, date: v })}
              />

              <Text style={styles.label}>Shift Pattern *</Text>
              {shiftPatterns.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectOption, assignForm.shift_pattern_id === p.id?.toString() && styles.selectOptionActive]}
                  onPress={() => setAssignForm({ ...assignForm, shift_pattern_id: p.id?.toString() })}
                >
                  <View style={[styles.shiftDot, { backgroundColor: p.color || GOLD }]} />
                  <Text style={styles.selectOptionText}>{p.name}</Text>
                  {p.start_time && <Text style={styles.selectOptionSub}>{p.start_time}–{p.end_time}</Text>}
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes..."
                value={assignForm.notes}
                onChangeText={(v) => setAssignForm({ ...assignForm, notes: v })}
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssignModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleAssignShift} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Assign</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Create Pattern Modal */}
      <Modal visible={showPatternModal} transparent animationType="slide" onRequestClose={() => setShowPatternModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Shift Pattern</Text>
                <TouchableOpacity onPress={() => setShowPatternModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Pattern Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Morning Shift" value={patternForm.name} onChangeText={(v) => setPatternForm({ ...patternForm, name: v })} />

              <Text style={styles.label}>Type</Text>
              <View style={styles.optionsRow}>
                {['day', 'night', 'off'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.optionBtn, patternForm.type === t && styles.optionBtnActive]}
                    onPress={() => setPatternForm({ ...patternForm, type: t })}
                  >
                    <Text style={[styles.optionBtnText, patternForm.type === t && styles.optionBtnTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Start Time (HH:MM)</Text>
              <TextInput style={styles.input} placeholder="e.g. 08:00" value={patternForm.start_time} onChangeText={(v) => setPatternForm({ ...patternForm, start_time: v })} />

              <Text style={styles.label}>End Time (HH:MM)</Text>
              <TextInput style={styles.input} placeholder="e.g. 16:00" value={patternForm.end_time} onChangeText={(v) => setPatternForm({ ...patternForm, end_time: v })} />

              <Text style={styles.label}>Description (optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Pattern description..." value={patternForm.description} onChangeText={(v) => setPatternForm({ ...patternForm, description: v })} multiline numberOfLines={2} />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPatternModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreatePattern} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Create Pattern</Text>}
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
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  activeTab: { backgroundColor: GOLD, borderColor: GOLD },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  tabContent: { flex: 1 },
  calendarActions: { flexDirection: 'row', marginTop: 10, marginBottom: 8 },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GOLD, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  assignBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  dayDetail: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  dayDetailTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  shiftChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  shiftDot: { width: 8, height: 8, borderRadius: 4 },
  shiftChipName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  shiftChipPattern: { fontSize: 12, color: '#6b7280' },
  assignHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2',
  },
  clearBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  rotaCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  lockedCard: { borderColor: '#fca5a5' },
  rotaCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  rotaEmployee: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rotaDate: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  rotaRight: { alignItems: 'flex-end', gap: 4 },
  shiftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  shiftBadgeText: { fontSize: 11, fontWeight: '600' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  lockedBadgeText: { fontSize: 10, color: '#6b7280' },
  rotaTime: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  rotaNotes: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginBottom: 4 },
  rotaActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  lockBtnText: { fontSize: 12, color: '#6b7280' },
  deleteRotaBtn: { padding: 5 },
  patternCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  patternHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 8 },
  patternInfo: { flex: 1 },
  patternName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  patternMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  patternTime: { fontSize: 12, color: '#6b7280' },
  patternDesc: { fontSize: 12, color: '#9ca3af' },
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
  selectOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 6, backgroundColor: '#f9fafb',
  },
  selectOptionActive: { borderColor: GOLD, backgroundColor: '#fffbeb' },
  selectOptionText: { fontSize: 14, color: '#374151', flex: 1 },
  selectOptionSub: { fontSize: 12, color: '#9ca3af' },
  optionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
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

export default RotaManagement;
