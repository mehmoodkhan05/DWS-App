import React from 'react';
import { View, StyleSheet } from 'react-native';
import Reports from '../components/dashboard/Reports';

const ReportsScreen = () => {
  return (
    <View style={styles.container}>
      <Reports />
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

export default ReportsScreen;
