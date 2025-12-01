const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { addAuditLog } = require('../services/auditLog');
const logger = require('../services/logger');

// In-memory storage for federal kit and vehicles
const federalKit = {
  capabilities: [
    {
      id: 'it-services',
      name: 'IT Services',
      description: 'Comprehensive IT solutions for federal agencies',
      category: 'services'
    },
    {
      id: 'cybersecurity',
      name: 'Cybersecurity',
      description: 'Security assessments, compliance, and protection services',
      category: 'services'
    },
    {
      id: 'cloud-solutions',
      name: 'Cloud Solutions',
      description: 'FedRAMP authorized cloud migration and management',
      category: 'services'
    },
    {
      id: 'consulting',
      name: 'Strategic Consulting',
      description: 'Federal IT modernization and transformation consulting',
      category: 'services'
    }
  ],
  certifications: [
    { id: 'sdvosb', name: 'SDVOSB', description: 'Service-Disabled Veteran-Owned Small Business' },
    { id: 'vosb', name: 'VOSB', description: 'Veteran-Owned Small Business' }
  ],
  naicsCodes: [
    { code: '541511', description: 'Custom Computer Programming Services' },
    { code: '541512', description: 'Computer Systems Design Services' },
    { code: '541513', description: 'Computer Facilities Management Services' },
    { code: '541519', description: 'Other Computer Related Services' },
    { code: '541611', description: 'Administrative Management and General Management Consulting Services' },
    { code: '518210', description: 'Data Processing, Hosting, and Related Services' }
  ]
};

const contractVehicles = [
  {
    id: 'gsa-schedule',
    name: 'GSA Schedule',
    fullName: 'GSA Multiple Award Schedule (MAS)',
    description: 'Simplified acquisition for federal agencies',
    categories: ['IT', 'Professional Services'],
    status: 'active'
  },
  {
    id: 'sewp',
    name: 'NASA SEWP V',
    fullName: 'Solutions for Enterprise-Wide Procurement',
    description: 'GWAC for IT products and services',
    categories: ['IT Products', 'Cloud'],
    status: 'active'
  },
  {
    id: 'cio-sp3',
    name: 'CIO-SP3',
    fullName: 'Chief Information Officer - Solutions and Partners 3',
    description: 'IT services and solutions for all federal agencies',
    categories: ['IT Services', 'Cybersecurity'],
    status: 'active'
  }
];

/**
 * Federal capabilities page
 * GET /federal
 */
router.get('/', (req, res) => {
  res.render('federal/index', {
    title: 'Federal Capabilities - MTCM Portal',
    federalKit,
    contractVehicles
  });
});

/**
 * Get federal kit data
 * GET /federal/kit
 */
router.get('/kit', (req, res) => {
  res.json({
    capabilities: federalKit.capabilities,
    certifications: federalKit.certifications,
    naicsCodes: federalKit.naicsCodes
  });
});

/**
 * Get contract vehicles
 * GET /federal/vehicles
 */
router.get('/vehicles', (req, res) => {
  res.json({
    vehicles: contractVehicles
  });
});

/**
 * Get specific vehicle details
 * GET /federal/vehicles/:id
 */
router.get('/vehicles/:id', (req, res) => {
  const vehicle = contractVehicles.find(v => v.id === req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  
  res.json(vehicle);
});

/**
 * NAICS code lookup
 * GET /federal/naics
 */
router.get('/naics', (req, res) => {
  const { search } = req.query;
  
  let codes = federalKit.naicsCodes;
  
  if (search) {
    const searchLower = search.toLowerCase();
    codes = codes.filter(c => 
      c.code.includes(search) || 
      c.description.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({ naicsCodes: codes });
});

/**
 * Certifications info
 * GET /federal/certifications
 */
router.get('/certifications', (req, res) => {
  res.json({
    certifications: federalKit.certifications,
    verificationUrl: 'https://www.vip.vetbiz.va.gov/'
  });
});

/**
 * Request federal quote (requires auth)
 * POST /federal/quote
 */
router.post('/quote', requireAuth, (req, res) => {
  const { vehicleId, requirements, timeline, budget } = req.body;
  
  if (!vehicleId || !requirements) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      message: 'Vehicle and requirements are required' 
    });
  }

  const quote = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    userId: req.user.id,
    userEmail: req.user.email,
    vehicleId,
    requirements,
    timeline,
    budget,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  addAuditLog({
    action: 'QUOTE_REQUEST',
    userId: req.user.id,
    userEmail: req.user.email,
    details: `Federal quote requested for ${vehicleId}`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { quoteId: quote.id, vehicleId }
  });

  logger.info(`Federal quote requested by ${req.user.email} for ${vehicleId}`);

  res.status(201).json({
    success: true,
    message: 'Quote request submitted successfully',
    quote: {
      id: quote.id,
      status: quote.status,
      createdAt: quote.createdAt
    }
  });
});

module.exports = router;
