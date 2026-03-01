import React from 'react';
import { View, StyleSheet } from 'react-native';
import AnnouncementsPanel from '../components/announcements/AnnouncementsPanel';

const AnnouncementsScreen = () => {
  return (
    <View style={styles.container}>
      <AnnouncementsPanel />
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

export default AnnouncementsScreen;
