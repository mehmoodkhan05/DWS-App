import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import profilesRoutes from './routes/profiles.js';
import rotasRoutes from './routes/rotas.js';
import requestsRoutes from './routes/requests.js';
import messagesRoutes from './routes/messages.js';
import announcementsRoutes from './routes/announcements.js';
import auditLogRoutes from './routes/auditLog.js';
import expenseCategoriesRoutes from './routes/expenseCategories.js';
import expensesRoutes from './routes/expenses.js';
import incomeRoutes from './routes/income.js';
import salariesRoutes from './routes/salaries.js';
import advanceSalariesRoutes from './routes/advanceSalaries.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS: allow multiple origins (comma-separated CORS_ORIGINS) or FRONTEND_URL + localhost
const localhostOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [...new Set([(process.env.FRONTEND_URL || 'http://localhost:5173'), ...localhostOrigins])];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || allowedOrigins[0]);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (avatars) - stored at project-root/uploads
const uploadsPath = path.join(__dirname, '..', 'uploads');
const avatarsPath = path.join(uploadsPath, 'avatars');
if (!fs.existsSync(avatarsPath)) {
  fs.mkdirSync(avatarsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Base path for subdirectory deployments (e.g., /dwsoffice/)
// This needs to be applied BEFORE API routes so they work correctly
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware to strip base path from requests if present
// This handles cases where cPanel doesn't strip the subdirectory prefix
// Also handles cases where the path might include the base path
if (BASE_PATH || NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Use req.url instead of req.path to get the full original URL
    let originalUrl = req.url;
    let needsUpdate = false;
    let newPath = originalUrl;
    
    // Extract path without query string for checking
    const urlPath = originalUrl.split('?')[0];
    const queryString = originalUrl.includes('?') ? originalUrl.substring(originalUrl.indexOf('?')) : '';
    
    // If BASE_PATH is set and path starts with it, strip it
    if (BASE_PATH && urlPath.startsWith(BASE_PATH)) {
      newPath = urlPath.replace(BASE_PATH, '') || '/';
      needsUpdate = true;
    }
    // Also check common subdirectory patterns (in case BASE_PATH isn't set but path includes /dwsoffice/)
    else if (urlPath.startsWith('/dwsoffice/')) {
      newPath = urlPath.replace('/dwsoffice/', '/');
      needsUpdate = true;
    }
    // Check for /dwsoffice/api pattern specifically
    else if (urlPath.startsWith('/dwsoffice/api')) {
      newPath = urlPath.replace('/dwsoffice', '');
      needsUpdate = true;
    }
    
    // Update the request URL (req.path is read-only, so we modify req.url)
    if (needsUpdate) {
      req.url = newPath + queryString;
      console.log(`Path normalized: ${originalUrl} -> ${req.url}`);
    }
    next();
  });
}

// API Routes
// Health check endpoint (before other API routes)
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    message: 'Delta Guard Rota API is running',
    timestamp: new Date().toISOString(),
    database: 'unknown'
  };

  // Check database connection
  try {
    const pool = (await import('./config/database.js')).default;
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.databaseError = error.message;
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/rotas', rotasRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/expense-categories', expenseCategoriesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/salaries', salariesRoutes);
app.use('/api/advance-salaries', advanceSalariesRoutes);

// Serve static files from React app in production
if (NODE_ENV === 'production') {
  // Allow custom frontend path via environment variable, otherwise use default relative path
  const frontendDistPath = process.env.FRONTEND_DIST_PATH 
    ? path.resolve(process.env.FRONTEND_DIST_PATH)
    : path.join(__dirname, '../frontend/dist');
  
  // Base path for subdirectory deployments (e.g., /dwsoffice/)
  const BASE_PATH = process.env.BASE_PATH || '';
  
  // Check if frontend dist directory exists
  if (!fs.existsSync(frontendDistPath)) {
    console.error(`❌ ERROR: Frontend dist directory not found at: ${frontendDistPath}`);
    console.error(`   Please verify the frontend/dist files are uploaded correctly.`);
    console.error(`   Current backend directory: ${__dirname}`);
  } else {
    console.log(`✅ Frontend files found at: ${frontendDistPath}`);
    if (BASE_PATH) {
      console.log(`📁 Base path configured: ${BASE_PATH}`);
    }
    
    // Serve static files with proper MIME types
    // This must come before the catch-all route
    app.use(express.static(frontendDistPath, {
      // Set proper MIME types for JavaScript modules
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
      },
      index: false // Don't serve index.html for directory requests
    }));
    
    // Explicit asset serving middleware (fallback if static middleware doesn't catch it)
    app.use((req, res, next) => {
      // Only handle asset requests
      if (req.path.startsWith('/assets/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        const filePath = path.join(frontendDistPath, req.path);
        
        // Check if file exists
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          // Set proper MIME type
          if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
          } else if (filePath.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
          }
          
          return res.sendFile(filePath);
        } else {
          // File doesn't exist - log for debugging
          console.error(`❌ Asset not found: ${req.path} (looked in: ${filePath})`);
          return res.status(404).json({ 
            error: 'Asset not found',
            path: req.path,
            expectedPath: filePath
          });
        }
      }
      next();
    });
    
    // Explicitly handle base path routes
    app.get('/dwsoffice', (req, res) => {
      const indexPath = path.join(frontendDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Frontend files not found.');
      }
    });
    
    app.get('/dwsoffice/', (req, res) => {
      const indexPath = path.join(frontendDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Frontend files not found.');
      }
    });
    
    // Serve React app for all non-API routes (catch-all must be last)
    // Only serve index.html for routes that don't match static files
    app.get('*', (req, res, next) => {
      // Get both original and normalized paths
      const originalPath = req.originalUrl || req.url;
      const normalizedPath = req.path;
      
      // Extract path without query string
      const originalPathOnly = originalPath.split('?')[0];
      
      // Don't serve index.html for API routes (check both original and normalized paths)
      if (normalizedPath.startsWith('/api') || originalPathOnly.startsWith('/api') || originalPathOnly.startsWith('/dwsoffice/api')) {
        return res.status(404).json({ error: 'Route not found' });
      }
      
      // Don't serve index.html for asset requests (they should have been handled by static middleware)
      // If we get here for an asset request, it means the file doesn't exist
      if (normalizedPath.startsWith('/assets/') || originalPathOnly.startsWith('/assets/') || 
          originalPathOnly.startsWith('/dwsoffice/assets/') ||
          normalizedPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
          originalPathOnly.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      // For all other routes (including /dwsoffice/), serve index.html for SPA routing
      const indexPath = path.join(frontendDistPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.error(`❌ ERROR: index.html not found at: ${indexPath}`);
        return res.status(500).send('Frontend files not found. Please check deployment.');
      }
      
      // Set proper content type
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(indexPath);
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler for API routes (only if not in production or if it's an API route)
if (NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});
