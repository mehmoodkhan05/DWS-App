import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AuditLog from '../components/dashboard/AuditLog';

const AuditLogScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <AuditLog />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default AuditLogScreen;
