import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  const navigationRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('AppContent - Auth state:', { isAuthenticated, loading });
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!loading && isReady && navigationRef.current) {
      console.log('Navigating based on auth state:', isAuthenticated);
      if (isAuthenticated) {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        });
      }
    }
  }, [isAuthenticated, loading, isReady]);

  const onNavigationReady = () => {
    console.log('Navigation container ready');
    setIsReady(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={isAuthenticated ? "Main" : "Auth"}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
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
