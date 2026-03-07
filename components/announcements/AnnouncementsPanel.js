import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Switch, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { formatDateOnly } from '../../lib/utils';

const GOLD = '#d4af37';

const AnnouncementsPanel = () => {
  const { isAdmin, isManager } = useAuth();
  const isAdminOrManager = isAdmin || isManager;
  const { announcements, loading, createAnnouncement, deleteAnnouncement } = useAnnouncements();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    target_role: 'all',
    target_department: '',
    expires_at: '',
    is_pinned: false,
  });

  const TARGET_ROLE_OPTIONS = ['all', 'admin', 'manager', 'employee'];

  const sortedAnnouncements = useMemo(() => {
    const now = new Date();
    return [...announcements].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [announcements]);

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnnouncement(id);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    if (!form.content.trim()) {
      Alert.alert('Validation', 'Content is required.');
      return;
    }
    try {
      setSubmitting(true);
      await createAnnouncement({
        title: form.title,
        content: form.content,
        target_role: form.target_role,
        target_department: form.target_department || null,
        expires_at: form.expires_at || null,
        is_pinned: form.is_pinned,
      });
      setForm({ title: '', content: '', target_role: 'all', target_department: '', expires_at: '', is_pinned: false });
      setShowCreateModal(false);
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
      {isAdminOrManager && (
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.createBtnText}>New Announcement</Text>
        </TouchableOpacity>
      )}

      {sortedAnnouncements.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="megaphone-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No announcements</Text>
        </View>
      ) : (
        <FlatList
          data={sortedAnnouncements}
          keyExtractor={(item) => item.id?.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const expired = isExpired(item.expires_at);
            return (
              <View style={[
                styles.card,
                item.is_pinned && styles.pinnedCard,
                expired && styles.expiredCard,
              ]}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    {!!item.is_pinned && (
                      <Ionicons name="pin" size={14} color={GOLD} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.cardTitle, expired && styles.expiredText]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                  {isAdminOrManager && (
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.badgeRow}>
                  {item.target_role && item.target_role !== 'all' && (
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{item.target_role}</Text>
                    </View>
                  )}
                  {item.target_department && (
                    <View style={styles.deptBadge}>
                      <Text style={styles.deptBadgeText}>{item.target_department}</Text>
                    </View>
                  )}
                  {expired && (
                    <View style={styles.expiredBadge}>
                      <Text style={styles.expiredBadgeText}>Expired</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.content, expired && styles.expiredText]}>
                  {item.content}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.author}>By {item.author_name || 'Admin'}</Text>
                  <View style={styles.footerRight}>
                    <Text style={styles.dateText}>{formatDateOnly(item.created_at)}</Text>
                    {item.expires_at && (
                      <Text style={styles.expiresText}>
                        Expires {formatDateOnly(item.expires_at)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Create Announcement Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Announcement</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Announcement title"
                value={form.title}
                onChangeText={(v) => setForm({ ...form, title: v })}
              />

              <Text style={styles.label}>Content *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Announcement content..."
                value={form.content}
                onChangeText={(v) => setForm({ ...form, content: v })}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Target Role</Text>
              <View style={styles.optionsRow}>
                {TARGET_ROLE_OPTIONS.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.optionBtn, form.target_role === role && styles.optionBtnActive]}
                    onPress={() => setForm({ ...form, target_role: role })}
                  >
                    <Text style={[styles.optionBtnText, form.target_role === role && styles.optionBtnTextActive]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Target Department (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Security, Operations"
                value={form.target_department}
                onChangeText={(v) => setForm({ ...form, target_department: v })}
              />

              <Text style={styles.label}>Expiry Date (YYYY-MM-DD, optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-04-01"
                value={form.expires_at}
                onChangeText={(v) => setForm({ ...form, expires_at: v })}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Pin Announcement</Text>
                <Switch
                  value={form.is_pinned}
                  onValueChange={(v) => setForm({ ...form, is_pinned: v })}
                  trackColor={{ false: '#d1d5db', true: GOLD }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Post Announcement</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: GOLD, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 10, alignSelf: 'flex-start', marginBottom: 16,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  pinnedCard: { borderColor: GOLD, borderWidth: 1.5 },
  expiredCard: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  expiredText: { color: '#9ca3af' },
  deleteBtn: { padding: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roleBadge: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  deptBadge: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  deptBadgeText: { fontSize: 11, color: '#166534', fontWeight: '600' },
  expiredBadge: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  expiredBadgeText: { fontSize: 11, color: '#991b1b', fontWeight: '600' },
  content: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  author: { fontSize: 11, color: '#9ca3af' },
  footerRight: { alignItems: 'flex-end' },
  dateText: { fontSize: 11, color: '#9ca3af' },
  expiresText: { fontSize: 11, color: '#f59e0b', marginTop: 2 },
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
  textArea: { height: 90, textAlignVertical: 'top' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
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

export default AnnouncementsPanel;
