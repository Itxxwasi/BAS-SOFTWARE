const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ msg: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if decoded has user object (nested) or id directly (flat)
    const userId = decoded.user ? decoded.user.id : decoded.id;

    req.user = await User.findById(userId).select('-password');

    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    // Check if user is active
    if (!req.user.isActive) {
      return res.status(401).json({ msg: 'User account is deactivated' });
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ msg: 'Not authorized to access this route' });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        msg: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Role-based access control according to windsurf.md specifications
exports.adminAccess = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      msg: 'Admin access required'
    });
  }
  next();
};

// Sales User can manage sales & sales returns only
exports.salesAccess = (req, res, next) => {
  if (!['admin', 'manager', 'sales'].includes(req.user.role)) {
    return res.status(403).json({
      msg: 'Sales access required'
    });
  }
  next();
};

// Accounts User manages cash, bank, ledgers & reports
exports.accountsAccess = (req, res, next) => {
  if (!['admin', 'manager', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({
      msg: 'Accounts access required'
    });
  }
  next();
};

// Manager has limited admin access
exports.managerAccess = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      msg: 'Manager access required'
    });
  }
  next();
};
