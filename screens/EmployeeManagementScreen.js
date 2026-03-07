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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

export default EmployeeManagementScreen;
