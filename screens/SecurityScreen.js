import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Switch } from 'react-native';
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

const SecurityScreen = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSetting = (section, key, value) => {
    const updated = { ...settings, [section]: { ...settings[section], [key]: value } };
    setSettings(updated);
    saveSettings(updated).catch(() => Alert.alert('Error', 'Failed to save settings.'));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <SectionHeader icon="shield-outline" title="Security Settings" />

        <SettingRow label="Two-Factor Authentication" subtitle="Add extra security to your account">
          <Switch
            value={settings.security.twoFactorEnabled}
            onValueChange={(v) => updateSetting('security', 'twoFactorEnabled', v)}
            trackColor={{ false: '#d1d5db', true: GOLD }}
            thumbColor="#fff"
          />
        </SettingRow>

        <SettingRow label="Audit Logging" subtitle="Track all user actions">
          <Switch
            value={settings.security.auditLogging}
            onValueChange={(v) => updateSetting('security', 'auditLogging', v)}
            trackColor={{ false: '#d1d5db', true: GOLD }}
            thumbColor="#fff"
          />
        </SettingRow>

        <View style={styles.inputRow}>
          <Text style={styles.inputRowLabel}>Session Timeout (minutes)</Text>
          <TextInput
            style={styles.smallInput}
            value={settings.security.sessionTimeout?.toString()}
            onChangeText={(v) => updateSetting('security', 'sessionTimeout', parseInt(v) || 30)}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputRowLabel}>Password Expiry (days)</Text>
          <TextInput
            style={styles.smallInput}
            value={settings.security.passwordExpiry?.toString()}
            onChangeText={(v) => updateSetting('security', 'passwordExpiry', parseInt(v) || 90)}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputRowLabel}>Max Login Attempts</Text>
          <TextInput
            style={styles.smallInput}
            value={settings.security.maxLoginAttempts?.toString()}
            onChangeText={(v) => updateSetting('security', 'maxLoginAttempts', parseInt(v) || 5)}
            keyboardType="numeric"
          />
        </View>
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
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  inputRowLabel: { fontSize: 14, color: '#374151', flex: 1 },
  smallInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb', width: 80, textAlign: 'center' },
});

export default SecurityScreen;
