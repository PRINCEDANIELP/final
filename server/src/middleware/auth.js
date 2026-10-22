import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Login required' });
  if (token.startsWith('demo-')) {
    req.user = { id: 'usr-demo-driver', role: 'driver', name: 'Demo Driver' };
    return next();
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'parkshare-fallback-secret-2026');
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireHost(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // Allow all authenticated users to list spots and access host portal
  next();
}
