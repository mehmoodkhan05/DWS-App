import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Settings from '../components/dashboard/Settings';

const SettingsScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <Settings />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default SettingsScreen;
