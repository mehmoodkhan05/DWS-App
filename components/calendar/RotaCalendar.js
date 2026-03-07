import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRotas } from '../../hooks/useRotas';

const GOLD = '#d4af37';

const RotaCalendar = () => {
  const { user, isAdmin, isManager } = useAuth();
  const { rotas, loading, refetch } = useRotas();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Admins/managers see ALL shifts; employees see only their own
  const isAdminOrManager = isAdmin || isManager;
  const displayRotas = isAdminOrManager
    ? rotas
    : rotas.filter((r) => r.employee_id === user?.id);

  // Poll every 10 seconds (matching webapp behaviour)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Build marked dates — multi-dot for admin (one dot per employee), single dot for employee
  const markedDates = {};
  displayRotas.forEach((rota) => {
    const shiftType = rota.shift_pattern?.type || 'off';
    const color = rota.shift_pattern?.color ||
      (shiftType === 'day' ? '#fbbf24' : shiftType === 'night' ? '#1e293b' : '#9ca3af');

    if (!markedDates[rota.date]) {
      markedDates[rota.date] = { dots: [] };
    }
    // Cap dots at 3 to avoid overflow; key must be a string for react-native-calendars
    if (markedDates[rota.date].dots.length < 3) {
      markedDates[rota.date].dots.push({ color, key: String(rota.id) });
    }
  });

  // Highlight selected date
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: GOLD,
    };
  }

  // Shifts on the selected date
  const shiftsOnDate = displayRotas.filter((r) => r.date === selectedDate);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={GOLD} />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        markedDates={markedDates}
        markingType="multi-dot"
        onDayPress={(day) => setSelectedDate(day.dateString)}
        theme={{
          todayTextColor: GOLD,
          selectedDayBackgroundColor: GOLD,
          arrowColor: GOLD,
          dotColor: GOLD,
          selectedDotColor: '#fff',
        }}
      />

      {/* Shifts on selected date */}
      <View style={styles.detailSection}>
        <Text style={styles.detailTitle}>
          {selectedDate === new Date().toISOString().split('T')[0]
            ? "Today's Shifts"
            : `Shifts on ${selectedDate}`}
        </Text>

        {shiftsOnDate.length === 0 ? (
          <View style={styles.noShift}>
            <Ionicons name="calendar-outline" size={20} color="#d1d5db" />
            <Text style={styles.noShiftText}>No shifts scheduled</Text>
          </View>
        ) : (
          shiftsOnDate.map((rota) => {
            const shiftColor = rota.shift_pattern?.color ||
              (rota.shift_pattern?.type === 'day' ? '#fbbf24'
                : rota.shift_pattern?.type === 'night' ? '#1e293b' : '#9ca3af');
            return (
              <View key={rota.id} style={styles.shiftRow}>
                <View style={[styles.shiftColorBar, { backgroundColor: shiftColor }]} />
                <View style={styles.shiftInfo}>
                  {isAdminOrManager && (
                    <Text style={styles.shiftEmployee}>{rota.employee_name}</Text>
                  )}
                  <Text style={styles.shiftName}>
                    {rota.shift_pattern?.name || 'Shift'}
                  </Text>
                  {rota.shift_pattern?.start_time && (
                    <Text style={styles.shiftTime}>
                      {rota.shift_pattern.start_time} – {rota.shift_pattern.end_time}
                    </Text>
                  )}
                  {rota.notes && (
                    <Text style={styles.shiftNotes}>{rota.notes}</Text>
                  )}
                </View>
                {!!rota.is_locked && (
                  <Ionicons name="lock-closed" size={14} color="#9ca3af" />
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
  },
  detailSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 14,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shiftColorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  shiftInfo: {
    flex: 1,
    padding: 10,
  },
  shiftEmployee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  shiftName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  shiftTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  shiftNotes: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noShift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  noShiftText: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

export default RotaCalendar;
