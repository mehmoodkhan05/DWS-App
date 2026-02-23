import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { Ionicons } from '@expo/vector-icons';
import { formatDateOnly } from '../../lib/utils';

const RequestsPanel = () => {
  const { isAdmin, isManager, user } = useAuth();
  const { requests, loading, createRequest, updateRequestStatus, deleteRequest } = useRequests();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const filteredRequests = isAdmin || isManager
    ? requests
    : requests.filter(req => req.employee_id === user?.id);

  const handleCreateRequest = async () => {
    try {
      await createRequest(formData);
      setShowCreateModal(false);
      setFormData({ type: 'leave', start_date: '', end_date: '', reason: '' });
      Alert.alert('Success', 'Request created successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      await updateRequestStatus(id, 'approved');
      Alert.alert('Success', 'Request approved');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReject = async (id) => {
    Alert.prompt(
      'Reject Request',
      'Enter rejection reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            try {
              await updateRequestStatus(id, 'rejected', reason);
              Alert.alert('Success', 'Request rejected');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleDelete = async (id) => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to delete this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRequest(id);
              Alert.alert('Success', 'Request deleted');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  return (
    <View style={styles.container}>
      {(isAdmin || isManager) && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Create Request</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.requestsList}>
        {filteredRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View>
                <Text style={styles.requestEmployee}>{request.employee_name || 'Unknown'}</Text>
                <Text style={styles.requestType}>{request.type} Request</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                <Text style={styles.statusText}>{request.status}</Text>
              </View>
            </View>

            <View style={styles.requestDetails}>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Dates: </Text>
                {request.start_date}
                {request.end_date ? ` to ${request.end_date}` : ''}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Reason: </Text>
                {request.reason}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Submitted: </Text>
                {formatDateOnly(request.created_at)}
              </Text>
              {request.admin_notes && (
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Notes: </Text>
                  {request.admin_notes}
                </Text>
              )}
            </View>

            {(isAdmin || isManager) && request.status === 'pending' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleApprove(request.id)}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReject(request.id)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}

            {(isAdmin || isManager) && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(request.id)}
              >
                <Ionicons name="trash" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Request</Text>
            {/* Form inputs would go here */}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCreateRequest}
            >
              <Text style={styles.modalButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
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
  requestsList: {
    flex: 1,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestEmployee: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  requestType: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requestDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    padding: 8,
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
  modalCancelButton: {
    backgroundColor: '#6b7280',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RequestsPanel;
