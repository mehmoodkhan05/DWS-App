import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AdvanceSalaryPanel = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Advance Salary Request</Text>
      <Text style={styles.subtitle}>Advance salary functionality will be implemented here</Text>
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

export default AdvanceSalaryPanel;
