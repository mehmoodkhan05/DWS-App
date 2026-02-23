import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EmployeeManagement = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employee Management</Text>
      <Text style={styles.subtitle}>Employee management functionality will be implemented here</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default EmployeeManagement;
