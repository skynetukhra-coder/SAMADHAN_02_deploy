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

// Serve static assets in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Wildcard route to serve index.html for React routing
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend Server is listening on http://localhost:${PORT}`);
});
