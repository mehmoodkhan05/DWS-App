import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainNavigator from './navigation/MainNavigator';
import AuthScreen from './screens/AuthScreen';

// Suppress the Worklets version mismatch warning for Expo Go
// This is a known limitation when using reanimated with Expo Go
// The app will still function, but some animations might not work perfectly
LogBox.ignoreLogs([
  'WorkletsError',
  'Mismatch between JavaScript part and native part',
]);

const Stack = createStackNavigator();

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
