import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const ExpensesPanel = () => {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expenses</Text>
      <Text style={styles.subtitle}>Expense management functionality will be implemented here</Text>
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

export default ExpensesPanel;
