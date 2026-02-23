import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import RotaManagement from '../components/rota/RotaManagement';

const RotaManagementScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <RotaManagement />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default RotaManagementScreen;
