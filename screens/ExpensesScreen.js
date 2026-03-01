import React from 'react';
import { View, StyleSheet } from 'react-native';
import ExpensesPanel from '../components/expenses/ExpensesPanel';

const ExpensesScreen = () => {
  return (
    <View style={styles.container}>
      <ExpensesPanel />
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

export default ExpensesScreen;
