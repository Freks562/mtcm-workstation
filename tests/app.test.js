const request = require('supertest');
const app = require('../app');
const { resetStore } = require('../src/middleware/rateLimiter');
const settingsService = require('../src/services/settingsService');

// Increase test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll((done) => {
  // Reset settings
  settingsService.updateSettings({
    ALLOWLIST_IPS: '',
    ALLOWLIST_EMAIL_DOMAINS: '',
    FORCE_CAPTCHA_ALL: false
  });
  done();
});

describe('Lead Form', () => {
  beforeEach(() => {
    // Reset rate limiter between tests
    resetStore();
  });

  describe('GET /lead', () => {
    it('should display the lead form', async () => {
      const res = await request(app).get('/lead');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Lead');
      expect(res.text).toContain('name');
      expect(res.text).toContain('email');
    });
  });

  describe('POST /lead', () => {
    it('should submit successfully with valid data', async () => {
      const res = await request(app)
        .post('/lead')
        .send({
          name: 'Test User',
          org: 'Test Org',
          email: 'test@example.com',
          phone: '555-1234',
          notes: 'Test notes'
        });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Thank You');
    });

    it('should fail with missing name', async () => {
      const res = await request(app)
        .post('/lead')
        .send({
          email: 'test@example.com'
        });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Name is required');
    });

    it('should fail with missing email', async () => {
      const res = await request(app)
        .post('/lead')
        .send({
          name: 'Test User'
        });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Email is required');
    });

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/lead')
        .send({
          name: 'Test User',
          email: 'invalid-email'
        });
      expect(res.status).toBe(200);
      expect(res.text).toContain('valid email');
    });

    it('should detect honeypot submissions', async () => {
      const res = await request(app)
        .post('/lead')
        .send({
          name: 'Bot',
          email: 'bot@example.com',
          _hp_field: 'filled by bot'
        });
      expect(res.status).toBe(200);
      // Should appear successful to the bot
      expect(res.text).toContain('Thank You');
    });
  });
});

describe('Contact Form', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('GET /contact', () => {
    it('should display the contact form', async () => {
      const res = await request(app).get('/contact');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Contact');
      expect(res.text).toContain('name');
      expect(res.text).toContain('email');
    });
  });

  describe('POST /contact', () => {
    it('should submit successfully with valid data', async () => {
      const res = await request(app)
        .post('/contact')
        .send({
          name: 'Test User',
          org: 'Test Org',
          email: 'test@example.com',
          phone: '555-1234',
          notes: 'Test message'
        });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Thank You');
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/contact')
        .send({});
      expect(res.status).toBe(200);
      expect(res.text).toContain('required');
    });
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should allow initial requests', async () => {
    const res = await request(app)
      .post('/lead')
      .send({ name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(200);
  });

  it('should enforce rate limiting based on default config', async () => {
    // The default rate limit is 5 requests per window
    // We test that the store is being used by making multiple requests
    // and verifying we can make 5 requests successfully
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/lead')
        .send({ name: 'Test', email: 'test@example.com' });
      expect(res.status).toBe(200);
    }
    
    // The 6th request should be blocked
    const res = await request(app)
      .post('/lead')
      .send({ name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(429);
    expect(res.text).toContain('Too Many Requests');
  });
});


describe('Allowlist', () => {
  beforeEach(() => {
    resetStore();
    settingsService.updateSettings({
      ALLOWLIST_IPS: '127.0.0.1, 192.168.1.1',
      ALLOWLIST_EMAIL_DOMAINS: 'company.com, partner.org',
      FORCE_CAPTCHA_ALL: false
    });
  });

  afterEach(() => {
    settingsService.updateSettings({
      ALLOWLIST_IPS: '',
      ALLOWLIST_EMAIL_DOMAINS: '',
      FORCE_CAPTCHA_ALL: false
    });
  });

  it('should test IP allowlist correctly', () => {
    const result = settingsService.testAllowlist('192.168.1.1', null);
    expect(result.ip.allowed).toBe(true);
    expect(result.isAllowed).toBe(true);
  });

  it('should test email domain allowlist correctly', () => {
    const result = settingsService.testAllowlist(null, 'user@company.com');
    expect(result.email.allowed).toBe(true);
    expect(result.isAllowed).toBe(true);
  });

  it('should return false for non-allowlisted IP', () => {
    const result = settingsService.testAllowlist('10.0.0.1', null);
    expect(result.ip.allowed).toBe(false);
    expect(result.isAllowed).toBe(false);
  });

  it('should return false for non-allowlisted domain', () => {
    const result = settingsService.testAllowlist(null, 'user@other.com');
    expect(result.email.allowed).toBe(false);
    expect(result.isAllowed).toBe(false);
  });
});

describe('Admin Routes', () => {
  describe('GET /admin/login', () => {
    it('should display login page', async () => {
      const res = await request(app).get('/admin/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Login');
    });
  });

  describe('GET /admin without auth', () => {
    it('should redirect to login', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin/login');
    });
  });

  describe('POST /admin/login', () => {
    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/admin/login')
        .send({ username: 'wrong', password: 'wrong' });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Invalid');
    });
  });
});

describe('Homepage', () => {
  it('should display the homepage', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('MTCM Portal');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Not Found');
  });
});
