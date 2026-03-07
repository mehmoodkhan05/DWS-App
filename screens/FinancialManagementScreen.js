import React from 'react';
import { View, StyleSheet } from 'react-native';
import FinancialManagement from '../components/financial/FinancialManagement';

const FinancialManagementScreen = () => {
  return (
    <View style={styles.container}>
      <FinancialManagement />
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

export default FinancialManagementScreen;
