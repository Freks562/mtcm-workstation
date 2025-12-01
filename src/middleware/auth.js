/**
 * Basic authentication middleware for admin routes
 */
const basicAuth = (req, res, next) => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';

  // Check if already authenticated via session
  if (req.session && req.session.isAdmin) {
    return next();
  }

  // Check for login form submission
  if (req.method === 'POST' && req.path === '/login') {
    const { username, password } = req.body;
    if (username === adminUser && password === adminPass) {
      req.session.isAdmin = true;
      return res.redirect('/admin');
    }
    return res.render('admin/login', {
      title: 'Admin Login',
      error: 'Invalid credentials'
    });
  }

  // Show login page if not authenticated
  if (!req.session || !req.session.isAdmin) {
    if (req.path === '/login') {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: null
      });
    }
    return res.redirect('/admin/login');
  }

  next();
};

module.exports = { basicAuth };
