import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = 'dws_app_settings';

export const defaultSettings = {
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

export const loadSettings = async () => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : { ...defaultSettings };
  } catch (e) {
    console.error('Error loading settings:', e);
    return { ...defaultSettings };
  }
};

export const saveSettings = async (newSettings) => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  } catch (e) {
    throw new Error('Failed to save settings.');
  }
};
