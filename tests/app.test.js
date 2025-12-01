const request = require('supertest');
const app = require('../src/server');

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('mtcm-portal');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const res = await request(app).get('/health/live');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health info', async () => {
      const res = await request(app).get('/health/detailed');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('cpu');
      expect(res.body).toHaveProperty('system');
      expect(res.body.system).toHaveProperty('nodeVersion');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status', async () => {
      const res = await request(app).get('/health/ready');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
    });
  });

  describe('POST /health/drain', () => {
    it('should return draining status', async () => {
      const res = await request(app).post('/health/drain');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draining');
    });
  });

  describe('POST /health/activate', () => {
    it('should return active status', async () => {
      const res = await request(app).post('/health/activate');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });
});

describe('Home Page', () => {
  describe('GET /', () => {
    it('should return 200 and render home page', async () => {
      const res = await request(app).get('/');
      
      expect(res.status).toBe(200);
      expect(res.text).toContain('MTCM');
    });
  });
});

describe('Auth Endpoints', () => {
  describe('GET /auth/login', () => {
    it('should return 200 and render login page', async () => {
      const res = await request(app).get('/auth/login');
      
      expect(res.status).toBe(200);
      expect(res.text).toContain('Sign In');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/auth/me');
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });
  });
});

describe('Federal Endpoints', () => {
  describe('GET /federal', () => {
    it('should return 200 and render federal page', async () => {
      const res = await request(app).get('/federal');
      
      expect(res.status).toBe(200);
      expect(res.text).toContain('Federal Capabilities');
    });
  });

  describe('GET /federal/kit', () => {
    it('should return federal kit data', async () => {
      const res = await request(app).get('/federal/kit');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('capabilities');
      expect(res.body).toHaveProperty('certifications');
      expect(res.body).toHaveProperty('naicsCodes');
    });
  });

  describe('GET /federal/vehicles', () => {
    it('should return contract vehicles', async () => {
      const res = await request(app).get('/federal/vehicles');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('vehicles');
      expect(Array.isArray(res.body.vehicles)).toBe(true);
    });
  });

  describe('GET /federal/certifications', () => {
    it('should return certifications', async () => {
      const res = await request(app).get('/federal/certifications');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('certifications');
    });
  });
});

describe('Contact Endpoints', () => {
  describe('GET /contact', () => {
    it('should return 200 and render contact page', async () => {
      const res = await request(app).get('/contact');
      
      expect(res.status).toBe(200);
      expect(res.text).toContain('Contact');
    });
  });

  describe('POST /contact', () => {
    it('should reject invalid contact form', async () => {
      const res = await request(app)
        .post('/contact')
        .send({ name: 'Test' }); // Missing required fields
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept valid contact form', async () => {
      const res = await request(app)
        .post('/contact')
        .send({
          name: 'Test User',
          email: 'test@example.gov',
          subject: 'Test Subject',
          message: 'This is a test message that is long enough.'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle honeypot spam detection', async () => {
      const res = await request(app)
        .post('/contact')
        .send({
          name: 'Bot User',
          email: 'bot@spam.com',
          subject: 'Spam Subject',
          message: 'This is spam message',
          website: 'http://spam.com' // Honeypot field
        });
      
      // Should return success to fool the bot
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Protected Routes', () => {
  describe('GET /dashboard', () => {
    it('should redirect to login when not authenticated', async () => {
      const res = await request(app).get('/dashboard');
      
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });
  });

  describe('GET /weather', () => {
    it('should redirect to login when not authenticated', async () => {
      const res = await request(app).get('/weather');
      
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });
  });

  describe('GET /admin', () => {
    it('should redirect to login when not authenticated', async () => {
      const res = await request(app).get('/admin');
      
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent-page');
    
    expect(res.status).toBe(404);
  });
});
