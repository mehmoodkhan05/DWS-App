import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AdvanceSalaryPanel from '../components/advanceSalary/AdvanceSalaryPanel';

const AdvanceSalaryScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Advance Salary Request</Text>
      </View>
      <AdvanceSalaryPanel />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
});

export default AdvanceSalaryScreen;
