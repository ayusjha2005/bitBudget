const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();

// Security: Enable CORS with configured origin
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Body parsing with strict payload limit to prevent DoS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request timestamp, ID, and telemetry tracking
const { metricsTracker } = require('./services/monitoring/metrics');

app.use((req, res, next) => {
  req.startTime = Date.now();
  req.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    // Track non-static/non-metrics endpoints
    if (!req.path.startsWith('/metrics')) {
      metricsTracker.recordRequest(res.statusCode < 400 ? 'ALLOW' : 'REFUSE', duration);
    }
  });

  next();
});

// Health check endpoint (FS-2605 requirement)
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'safepay-ai',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    deterministicSecurityEngine: 'active',
  });
});

// API Routes
app.use('/payment', require('./routes/payment'));
app.use('/assistant', require('./routes/assistant'));
app.use('/assistant', require('./routes/onboarding'));
app.use('/invoice', require('./routes/invoice'));
app.use('/attack', require('./routes/attack'));
app.use('/audit', require('./routes/audit'));
app.use('/2fa', require('./routes/twoFactor'));
app.use('/proof', require('./routes/proof'));
app.use('/recovery', require('./routes/recovery'));
app.use('/elder', require('./routes/elder'));
app.use('/metrics', require('./routes/monitoring'));

// Non-production route to verify fail-closed error handling
if (config.nodeEnv !== 'production') {
  app.get('/test-error', (req, res, next) => {
    const err = new Error('Simulated failure');
    err.code = 'INTERNAL_ERROR';
    next(err);
  });
}

// Serve client frontend static build if present
const path = require('path');
const fs = require('fs');
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    const apiPrefixes = ['/payment', '/assistant', '/invoice', '/attack', '/audit', '/2fa', '/proof', '/recovery', '/elder', '/metrics', '/healthz', '/test-error'];
    if (apiPrefixes.some((p) => req.path.startsWith(p))) {
      return next();
    }
    if (req.method === 'GET' && req.accepts('html')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Centralized error handler - FAIL CLOSED
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProd = config.nodeEnv === 'production';

  // Never leak stack traces or internal secrets to user
  res.status(statusCode).json({
    error: {
      message: statusCode === 500 && isProd ? 'Internal Security & System Error' : err.message,
      code: err.code || 'INTERNAL_ERROR',
      requestId: req.id,
    },
    decision: 'REFUSE', // Default safety behavior: FAIL CLOSED
  });
});

module.exports = app;
