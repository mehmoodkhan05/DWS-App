import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import EmployeeManagement from '../components/employees/EmployeeManagement';

const EmployeeManagementScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <EmployeeManagement />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default EmployeeManagementScreen;
