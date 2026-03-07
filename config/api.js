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

// For production (cPanel API backend - subdomain: deltawatch.webypixels.com)
// API routes are expected at /api/*
//
// Try these URL patterns if you get 404 errors:
// Option 1: API at root (e.g. https://deltawatch.webypixels.com/api)
const PROD_API_URL_OPTION1 = 'https://deltawatch.webypixels.com/api';
// Option 2: With /backend path (if cPanel serves Node.js from /backend folder)
const PROD_API_URL_OPTION2 = 'https://deltawatch.webypixels.com/backend/api';
// Option 3: With /dwsoffice/backend path (legacy webypixels path)
const PROD_API_URL_OPTION3 = 'https://deltawatch.webypixels.com/dwsoffice/backend/api';

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

// Get base URL for static uploads (avatars) - server root without /api
export const getUploadsBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '') || apiUrl;
};

// Build full avatar URL from avatar_url stored in DB (e.g. /uploads/avatars/xxx.jpg)
export const getAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  const base = getUploadsBaseUrl();
  const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  return `${base}${path}`;
};
