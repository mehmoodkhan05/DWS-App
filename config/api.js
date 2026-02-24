// API Configuration
// Update these values based on your server setup
import { Platform } from 'react-native';

// ============================================
// CONFIGURATION: Toggle between local and production
// ============================================
// Set to true to use cPanel production backend
// Set to false to use local development server
const USE_PRODUCTION_BACKEND = true;

// For development (local testing)
// Android emulators need to use 10.0.2.2 instead of localhost
// iOS simulators and physical devices can use localhost or your machine's IP
const getDevApiUrl = () => {
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return 'http://10.0.2.2:5000/api';
  }
  // For iOS simulator or physical devices, use localhost
  // For physical devices on same network, you may need to use your computer's IP address
  return 'http://localhost:5000/api';
};

// For production (cPanel server)
// Based on server.js analysis:
// - Backend is in /dwsoffice/backend/ folder
// - Server has middleware that handles /dwsoffice/ paths
// - API routes are mounted at /api/*
//
// Try these URL patterns if you get 404 errors:
// Option 1: With /backend (current - if cPanel serves Node.js from /backend folder)
const PROD_API_URL_OPTION1 = 'https://webypixels.com/dwsoffice/backend/api';
// Option 2: Without /backend (if middleware strips /dwsoffice/backend to /api)
const PROD_API_URL_OPTION2 = 'https://webypixels.com/dwsoffice/api';
// Option 3: Direct API path (if backend is served at root)
const PROD_API_URL_OPTION3 = 'https://webypixels.com/api';

// ============================================
// CHANGE THIS TO THE OPTION THAT WORKS
// ============================================
// If you get 404 errors, try changing this to OPTION2 or OPTION3
const PROD_API_URL = PROD_API_URL_OPTION1;

// Get the API base URL
export const getApiBaseUrl = () => {
  // Force production if toggle is set
  if (USE_PRODUCTION_BACKEND) {
    console.log('🌐 Using production API:', PROD_API_URL);
    return PROD_API_URL;
  }
  
  // In development mode, use platform-specific localhost
  if (__DEV__) {
    const devUrl = getDevApiUrl();
    console.log('🔧 Using development API:', devUrl);
    return devUrl;
  }
  
  // Fallback to production in production builds
  return PROD_API_URL;
};

// You can also set this via environment variables in Expo
// For example, using expo-constants:
// import Constants from 'expo-constants';
// const apiUrl = Constants.expoConfig?.extra?.apiUrl || getApiBaseUrl();
