/**
 * API v1 Router - Main entry point for versioned API
 * Organizes all business domains under versioned structure
 */

const express = require('express');
const router = express.Router();

// Import domain routers
const businessRouter = require('./domains/business');
const dataRouter = require('./domains/data');
const configRouter = require('./domains/config');
const utilitiesRouter = require('./domains/utilities');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API v1 is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount domain routers
router.use('/business', businessRouter);
router.use('/data', dataRouter);
router.use('/config', configRouter);
router.use('/utilities', utilitiesRouter);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'VIP Mobile API v1',
    version: '1.0.0',
    domains: {
      business: '/api/v1/business - Core business operations',
      data: '/api/v1/data - Data management operations',
      config: '/api/v1/config - Configuration and settings',
      utilities: '/api/v1/utilities - Utility functions and uploads'
    },
    documentation: '/api/v1/docs',
    health: '/api/v1/health'
  });
});

module.exports = router;