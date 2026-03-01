import React from 'react';
import { View, StyleSheet } from 'react-native';
import RequestsPanel from '../components/requests/RequestsPanel';

const RequestsScreen = () => {
  return (
    <View style={styles.container}>
      <RequestsPanel />
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

export default RequestsScreen;
