import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loadSettings, saveSettings, defaultSettings } from '../lib/settingsStorage';

const GOLD = '#d4af37';

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon} size={18} color={GOLD} />
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const SettingRow = ({ label, subtitle, children }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>{label}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {children}
  </View>
);

const NOTIFICATION_ITEMS = [
  { key: 'emailNotifications', label: 'Email Notifications', subtitle: 'Receive notifications via email' },
  { key: 'pushNotifications', label: 'Push Notifications', subtitle: 'Receive push notifications' },
  { key: 'requestAlerts', label: 'Request Alerts', subtitle: 'Notifications for leave/swap requests' },
  { key: 'shiftAlerts', label: 'Shift Alerts', subtitle: 'Notifications for schedule changes' },
  { key: 'announcementAlerts', label: 'Announcement Alerts', subtitle: 'Notifications for new announcements' },
  { key: 'systemAlerts', label: 'System Alerts', subtitle: 'Critical system notifications' },
];

const NotificationsScreen = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSetting = (section, key, value) => {
    const updated = { ...settings, [section]: { ...settings[section], [key]: value } };
    setSettings(updated);
    saveSettings(updated).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <SectionHeader icon="notifications-outline" title="Notification Settings" />
        {NOTIFICATION_ITEMS.map((item) => (
          <SettingRow key={item.key} label={item.label} subtitle={item.subtitle}>
            <Switch
              value={settings.notifications[item.key]}
              onValueChange={(v) => updateSetting('notifications', item.key, v)}
              trackColor={{ false: '#d1d5db', true: GOLD }}
              thumbColor="#fff"
            />
          </SettingRow>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionHeaderText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  settingSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});

export default NotificationsScreen;
