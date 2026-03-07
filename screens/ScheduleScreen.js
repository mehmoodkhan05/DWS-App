import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import RotaCalendar from '../components/calendar/RotaCalendar';

const ScheduleScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Schedule</Text>
      </View>
      <View style={styles.calendarWrapper}>
        <RotaCalendar />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.2,
  },
  calendarWrapper: {
    padding: 20,
    paddingTop: 16,
  },
});

export default ScheduleScreen;
