import React from 'react';
import { View, StyleSheet } from 'react-native';
import AuditLog from '../components/dashboard/AuditLog';

const AuditLogScreen = () => {
  return (
    <View style={styles.container}>
      <AuditLog />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

export default AuditLogScreen;
