import React from 'react';
import { View, StyleSheet } from 'react-native';
import Settings from '../components/dashboard/Settings';

const SettingsScreen = () => {
  return (
    <View style={styles.container}>
      <Settings />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

export default SettingsScreen;
