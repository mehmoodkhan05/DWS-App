import React from 'react';
import { View, StyleSheet } from 'react-native';
import RotaManagement from '../components/rota/RotaManagement';

const RotaManagementScreen = () => {
  return (
    <View style={styles.container}>
      <RotaManagement />
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

export default RotaManagementScreen;
