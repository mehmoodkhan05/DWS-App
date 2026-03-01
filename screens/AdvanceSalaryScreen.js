import React from 'react';
import { View, StyleSheet } from 'react-native';
import AdvanceSalaryPanel from '../components/advanceSalary/AdvanceSalaryPanel';

const AdvanceSalaryScreen = () => {
  return (
    <View style={styles.container}>
      <AdvanceSalaryPanel />
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

export default AdvanceSalaryScreen;
