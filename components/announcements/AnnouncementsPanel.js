import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { Ionicons } from '@expo/vector-icons';
import { formatDateOnly } from '../../lib/utils';

const AnnouncementsPanel = () => {
  const { isAdmin, isManager } = useAuth();
  const { announcements, loading, createAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleDelete = async (id) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(id);
              Alert.alert('Success', 'Announcement deleted');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const filteredAnnouncements = announcements.filter(a => {
    const now = new Date();
    const notExpired = !a.expires_at || new Date(a.expires_at) > now;
    return notExpired;
  });

  return (
    <View style={styles.container}>
      {(isAdmin || isManager) && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Create Announcement</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.announcementsList}>
        {filteredAnnouncements.map((announcement) => {
          const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();
          
          return (
            <View
              key={announcement.id}
              style={[
                styles.announcementCard,
                announcement.is_pinned && styles.pinnedCard,
                isExpired && styles.expiredCard,
              ]}
            >
              <View style={styles.announcementHeader}>
                <View style={styles.announcementTitleRow}>
                  {announcement.is_pinned && (
                    <Ionicons name="pin" size={16} color="#d4af37" style={styles.pinIcon} />
                  )}
                  <Text style={styles.announcementTitle}>{announcement.title}</Text>
                </View>
                <View style={styles.badges}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {announcement.target_role || 'All'}
                    </Text>
                  </View>
                  {announcement.target_department && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{announcement.target_department}</Text>
                    </View>
                  )}
                </View>
                {(isAdmin || isManager) && (
                  <TouchableOpacity
                    onPress={() => handleDelete(announcement.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.announcementContent}>{announcement.content}</Text>

              <View style={styles.announcementFooter}>
                <Text style={styles.footerText}>
                  By {announcement.author_name || 'Unknown'}
                </Text>
                <Text style={styles.footerText}>
                  {formatDateOnly(announcement.created_at)}
                </Text>
                {announcement.expires_at && (
                  <Text
                    style={[
                      styles.footerText,
                      isExpired && styles.expiredText,
                    ]}
                  >
                    Expires: {formatDateOnly(announcement.expires_at)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Announcement</Text>
            {/* Form would go here */}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  announcementsList: {
    flex: 1,
  },
  announcementCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pinnedCard: {
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  expiredCard: {
    opacity: 0.6,
  },
  announcementHeader: {
    marginBottom: 12,
  },
  announcementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinIcon: {
    marginRight: 8,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#374151',
    textTransform: 'capitalize',
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
  },
  announcementContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
  },
  expiredText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#d4af37',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnnouncementsPanel;
