import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useProfiles } from '../../hooks/useProfiles';

const GOLD = '#d4af37';

const SETTINGS_KEY = 'dws_app_settings';

const defaultSettings = {
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    maxLoginAttempts: 5,
    auditLogging: true,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    requestAlerts: true,
    shiftAlerts: true,
    announcementAlerts: true,
    systemAlerts: false,
  },
  system: {
    maintenanceMode: false,
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 365,
  },
};

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

const Settings = () => {
  const { user, profile, logout } = useAuth();
  const { updateProfile } = useProfiles();

  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState(defaultSettings);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    employee_id: '',
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        department: profile.department || '',
        employee_id: profile.employee_id || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  const updateSetting = (section, key, value) => {
    const updated = { ...settings, [section]: { ...settings[section], [key]: value } };
    saveSettings(updated);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.full_name.trim()) { Alert.alert('Validation', 'Full name is required.'); return; }
    try {
      setSavingProfile(true);
      await updateProfile(user?.id, profileForm);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const tabs = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'security', label: 'Security', icon: 'shield-outline' },
    { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
    { key: 'system', label: 'System', icon: 'settings-outline' },
  ];

  const Avatar = ({ name, size = 64 }) => {
    const initials = name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <View>
            <View style={styles.profileCard}>
              <Avatar name={profile?.full_name} />
              <Text style={styles.profileName}>{profile?.full_name}</Text>
              <Text style={styles.profileEmail}>{profile?.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{profile?.role}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="person-outline" title="Profile Information" />

              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} value={profileForm.full_name} onChangeText={(v) => setProfileForm({ ...profileForm, full_name: v })} />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={profileForm.email} onChangeText={(v) => setProfileForm({ ...profileForm, email: v })} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={profileForm.phone} onChangeText={(v) => setProfileForm({ ...profileForm, phone: v })} keyboardType="phone-pad" placeholder="Phone number" />

              <Text style={styles.label}>Department</Text>
              <TextInput style={styles.input} value={profileForm.department} onChangeText={(v) => setProfileForm({ ...profileForm, department: v })} placeholder="Department" />

              <Text style={styles.label}>Employee ID</Text>
              <TextInput style={styles.input} value={profileForm.employee_id} onChangeText={(v) => setProfileForm({ ...profileForm, employee_id: v })} placeholder="Employee ID" />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
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
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <View style={styles.card}>
            <SectionHeader icon="notifications-outline" title="Notification Settings" />

            {[
              { key: 'emailNotifications', label: 'Email Notifications', subtitle: 'Receive notifications via email' },
              { key: 'pushNotifications', label: 'Push Notifications', subtitle: 'Receive push notifications' },
              { key: 'requestAlerts', label: 'Request Alerts', subtitle: 'Notifications for leave/swap requests' },
              { key: 'shiftAlerts', label: 'Shift Alerts', subtitle: 'Notifications for schedule changes' },
              { key: 'announcementAlerts', label: 'Announcement Alerts', subtitle: 'Notifications for new announcements' },
              { key: 'systemAlerts', label: 'System Alerts', subtitle: 'Critical system notifications' },
            ].map((item) => (
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
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <View style={styles.card}>
            <SectionHeader icon="settings-outline" title="System Settings" />

            <SettingRow label="Maintenance Mode" subtitle="Temporarily disable the system">
              <Switch
                value={settings.system.maintenanceMode}
                onValueChange={(v) => updateSetting('system', 'maintenanceMode', v)}
                trackColor={{ false: '#d1d5db', true: '#ef4444' }}
                thumbColor="#fff"
              />
            </SettingRow>

            <SettingRow label="Automatic Backup" subtitle="Automatically backup data">
              <Switch
                value={settings.system.autoBackup}
                onValueChange={(v) => updateSetting('system', 'autoBackup', v)}
                trackColor={{ false: '#d1d5db', true: GOLD }}
                thumbColor="#fff"
              />
            </SettingRow>

            <View style={styles.inputRow}>
              <Text style={styles.inputRowLabel}>Data Retention (days)</Text>
              <TextInput
                style={styles.smallInput}
                value={settings.system.dataRetention?.toString()}
                onChangeText={(v) => updateSetting('system', 'dataRetention', parseInt(v) || 365)}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.label}>Backup Frequency</Text>
            <View style={styles.optionsRow}>
              {['daily', 'weekly', 'monthly'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[styles.optionBtn, settings.system.backupFrequency === freq && styles.optionBtnActive]}
                  onPress={() => updateSetting('system', 'backupFrequency', freq)}
                >
                  <Text style={[styles.optionBtnText, settings.system.backupFrequency === freq && styles.optionBtnTextActive]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabsScroll: { flexGrow: 0, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  activeTab: { backgroundColor: GOLD, borderColor: GOLD },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  content: { flex: 1 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  avatar: { backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  roleBadge: { backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  roleBadgeText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionHeaderText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: GOLD, paddingVertical: 12, borderRadius: 8, marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5',
    paddingVertical: 12, borderRadius: 8, marginBottom: 20,
  },
  logoutBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  settingSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  inputRowLabel: { fontSize: 14, color: '#374151', flex: 1 },
  smallInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#111827',
    backgroundColor: '#f9fafb', width: 80, textAlign: 'center',
  },
  optionsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  optionBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  optionBtnText: { fontSize: 13, color: '#374151' },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
});

export default Settings;
