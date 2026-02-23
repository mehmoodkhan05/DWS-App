import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../contexts/AuthContext';
import { useRotas } from '../../hooks/useRotas';

const RotaCalendar = () => {
  const { user } = useAuth();
  const { rotas, loading } = useRotas();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter rotas for current user
  const userRotas = rotas.filter(rota => rota.employee_id === user?.id);

  // Create marked dates object for calendar
  const markedDates = {};
  userRotas.forEach(rota => {
    const shiftType = rota.shift_pattern?.type || 'off';
    let color = '#6b7280'; // off
    if (shiftType === 'day') color = '#fbbf24'; // yellow
    if (shiftType === 'night') color = '#1e293b'; // dark blue

    markedDates[rota.date] = {
      marked: true,
      dotColor: color,
      selected: rota.date === selectedDate,
      selectedColor: color,
    };
  });

  const selectedRota = userRotas.find(r => r.date === selectedDate);

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        theme={{
          todayTextColor: '#d4af37',
          selectedDayBackgroundColor: '#d4af37',
          arrowColor: '#d4af37',
        }}
      />

      {selectedRota && (
        <View style={styles.shiftDetails}>
          <Text style={styles.shiftTitle}>Shift Details</Text>
          <Text style={styles.shiftText}>
            <Text style={styles.shiftLabel}>Type: </Text>
            {selectedRota.shift_pattern?.name || 'Off'}
          </Text>
          {selectedRota.shift_pattern?.start_time && (
            <Text style={styles.shiftText}>
              <Text style={styles.shiftLabel}>Time: </Text>
              {selectedRota.shift_pattern.start_time} - {selectedRota.shift_pattern.end_time}
            </Text>
          )}
          {selectedRota.notes && (
            <Text style={styles.shiftText}>
              <Text style={styles.shiftLabel}>Notes: </Text>
              {selectedRota.notes}
            </Text>
          )}
        </View>
      )}

      {!selectedRota && (
        <View style={styles.noShift}>
          <Text style={styles.noShiftText}>No shift scheduled for this date</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shiftDetails: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  shiftTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  shiftText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  shiftLabel: {
    fontWeight: '600',
  },
  noShift: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  noShiftText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default RotaCalendar;
