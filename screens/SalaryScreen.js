import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import SalaryDetails from '../components/salary/SalaryDetails';

const SalaryScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Salary Details</Text>
      </View>
      <SalaryDetails />
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

export default SalaryScreen;
