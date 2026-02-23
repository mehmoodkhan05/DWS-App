// API Configuration
// Update these values based on your server setup

// For development (local testing)
const DEV_API_URL = 'http://localhost:5000/api';

// For production (cPanel server)
// Replace 'yourdomain.com' with your actual domain
// Based on your cPanel path: /home2/webypixels/public_html/dwsoffice/backend
// The API URL should be: https://yourdomain.com/dwsoffice/backend/api
// OR if backend is served directly: https://yourdomain.com/api
const PROD_API_URL = 'https://webypixels.com/dwsoffice/backend/api';

// Alternative: If your backend is at a subdomain
// const PROD_API_URL = 'https://api.yourdomain.com/api';

// Get the API base URL
export const getApiBaseUrl = () => {
  // In development mode, use localhost
  if (__DEV__) {
    return DEV_API_URL;
  }
  
  // In production, use the configured production URL
  return PROD_API_URL;
};

// You can also set this via environment variables in Expo
// For example, using expo-constants:
// import Constants from 'expo-constants';
// const apiUrl = Constants.expoConfig?.extra?.apiUrl || getApiBaseUrl();
