import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../hooks/useProfiles';
import { profilesAPI } from '../lib/api';
import { getAvatarUrl } from '../config/api';

const GOLD = '#d4af37';

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon} size={18} color={GOLD} />
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const ProfileScreen = () => {
  const { user, profile, logout, refreshProfile } = useAuth();
  const { updateProfile } = useProfiles();

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState(false);
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
    setProfileAvatarError(false);
  }, [profile?.avatar_url]);

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

  const avatarUrl = getAvatarUrl(profile?.avatar_url);
  const showProfileImage = avatarUrl && !profileAvatarError;

  const showAvatarActions = () => {
    if (Platform.OS === 'ios') {
      const { ActionSheetIOS } = require('react-native');
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Change Photo', 'Remove Photo', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (buttonIndex) => {
          if (buttonIndex === 0) handleChangeAvatar();
          if (buttonIndex === 1) handleRemoveAvatar();
        }
      );
    } else {
      Alert.alert('Profile Photo', undefined, [
        { text: 'Change Photo', onPress: handleChangeAvatar },
        { text: 'Remove Photo', onPress: handleRemoveAvatar, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
    if (!base64) {
      Alert.alert('Error', 'Could not process image. Please try another photo.');
      return;
    }
    try {
      setUploadingAvatar(true);
      await profilesAPI.uploadAvatar(user?.id, base64);
      await refreshProfile();
      Alert.alert('Success', 'Profile picture updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert('Remove Photo', 'Remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploadingAvatar(true);
            await profilesAPI.removeAvatar(user?.id);
            await refreshProfile();
            Alert.alert('Success', 'Profile picture removed.');
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to remove profile picture.');
          } finally {
            setUploadingAvatar(false);
          }
        },
      },
    ]);
  };

  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={showAvatarActions}
          disabled={uploadingAvatar}
          activeOpacity={0.8}
        >
          {showProfileImage ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              onError={() => setProfileAvatarError(true)}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
          {!uploadingAvatar && (
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change or remove</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrapper: { width: 80, height: 80, marginBottom: 12, position: 'relative', alignSelf: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(212, 175, 55, 0.3)' },
  avatarImage: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f9fafb', borderWidth: 2, borderColor: 'rgba(212, 175, 55, 0.2)' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 28 },
  avatarOverlay: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  roleBadge: { backgroundColor: '#fffbeb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5, marginTop: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  roleBadgeText: { fontSize: 13, color: '#b45309', fontWeight: '600', textTransform: 'capitalize' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionHeaderText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: GOLD, paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5', paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
  logoutBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
});

export default ProfileScreen;
