import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Reports from '../components/dashboard/Reports';

const ReportsScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <Reports />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default ReportsScreen;
