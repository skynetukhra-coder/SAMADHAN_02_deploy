const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getPool } = require('./db');

const authRoutes = require('./routes/auth');
const tokenRoutes = require('./routes/tokens');
const feedbackRoutes = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database connection pool asynchronously
getPool().catch(err => {
  console.error('Failed to initialize database pool on startup:', err.message);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/feedback', feedbackRoutes);

const path = require('path');
const fs = require('fs');

// Serve static assets in production (check local dist folder first, fallback to parent frontend/dist)
const distPath = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, '../frontend/dist');

app.use(express.static(distPath));

// Wildcard route to serve index.html for React routing
app.get('*', (req, res) => {
  const indexPath = fs.existsSync(path.join(distPath, 'index.html'))
    ? path.join(distPath, 'index.html')
    : path.resolve(__dirname, '../frontend', 'dist', 'index.html');
  res.sendFile(indexPath);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend Server is listening on http://localhost:${PORT}`);
});
