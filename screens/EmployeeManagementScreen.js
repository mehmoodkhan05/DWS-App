import React from 'react';
import { View, StyleSheet } from 'react-native';
import EmployeeManagement from '../components/employees/EmployeeManagement';

const EmployeeManagementScreen = () => {
  return (
    <View style={styles.container}>
      <EmployeeManagement />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
});

export default EmployeeManagementScreen;
