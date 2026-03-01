import React from 'react';
import { View, StyleSheet } from 'react-native';
import SalaryDetails from '../components/salary/SalaryDetails';

const SalaryScreen = () => {
  return (
    <View style={styles.container}>
      <SalaryDetails />
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

export default SalaryScreen;
