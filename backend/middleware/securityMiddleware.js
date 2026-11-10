/**
 * Security Middleware
 * 
 * Production-grade security middleware for the Report System.
 * 
 * Features:
 * - IP-based rate limiting (complements user-based rate limiting)
 * - Security event logging
 * - CSRF protection (lightweight token-based)
 * - Request validation
 */

import crypto from 'crypto';
import { sql, poolPromise } from '../config/db.js';

// ============================================================================
// IP-BASED RATE LIMITING
// ============================================================================

const ipRateLimitStore = new Map();
const IP_WINDOW_MS = 60 * 1000; // 1 minute
const IP_MAX_REQUESTS = 20; // 20 requests per minute per IP

/**
 * IP-based rate limiter
 * Complements user-based rate limiting in reportService
 */
export const ipRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const key = `ip:${ip}`;

  const entries = ipRateLimitStore.get(key) || [];
  const valid = entries.filter(t => now - t < IP_WINDOW_MS);

  if (valid.length >= IP_MAX_REQUESTS) {
    ipRateLimitStore.set(key, valid);
    
    logSecurityEvent({
      userId: req.user?.id || null,
      ipAddress: ip,
      eventType: 'RATE_LIMIT_IP',
      endpoint: req.originalUrl,
      metadata: JSON.stringify({ method: req.method, ip })
    }).catch(() => {});

    return res.status(429).json({
      message: 'Too many requests from this IP address. Please try again later.'
    });
  }

  valid.push(now);
  ipRateLimitStore.set(key, valid);
  next();
};

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of ipRateLimitStore.entries()) {
    const valid = entries.filter(t => now - t < IP_WINDOW_MS);
    if (valid.length === 0) {
      ipRateLimitStore.delete(key);
    } else {
      ipRateLimitStore.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// SECURITY EVENT LOGGING
// ============================================================================

export const logSecurityEvent = async ({ userId, ipAddress, eventType, endpoint, metadata }) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('userId', sql.Int, userId || null)
      .input('ipAddress', sql.NVarChar(45), ipAddress || null)
      .input('eventType', sql.VarChar(50), eventType)
      .input('endpoint', sql.VarChar(255), endpoint || null)
      .input('metadata', sql.NVarChar(sql.MAX), metadata || null)
      .query(`
        INSERT INTO security_events (user_id, ip_address, event_type, endpoint, metadata, created_at)
        VALUES (@userId, @ipAddress, @eventType, @endpoint, @metadata, SYSUTCDATETIME())
      `);
  } catch (err) {
    console.error('Failed to log security event:', err.message);
  }
};

export const logAuthFailure = (req, res, next) => {
  const originalSend = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      logSecurityEvent({
        userId: req.user?.id || null,
        ipAddress: req.ip || req.connection?.remoteAddress,
        eventType: res.statusCode === 401 ? 'AUTH_FAILED' : 'AUTH_FORBIDDEN',
        endpoint: req.originalUrl,
        metadata: JSON.stringify({ method: req.method })
      }).catch(() => {});
    }
    return originalSend(body);
  };
  next();
};

// ============================================================================
// CSRF PROTECTION
// ============================================================================

export const generateCsrfToken = (req, res, next) => {
  if (!req.session?.csrfToken) {
    const token = crypto.randomBytes(32).toString('hex');
    if (req.session) {
      req.session.csrfToken = token;
    }
    res.cookie('csrf-token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
  }
  next();
};

export const validateCsrfToken = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.['csrf-token'];
  const sessionToken = req.session?.csrfToken;

  if (headerToken && (headerToken === cookieToken || headerToken === sessionToken)) {
    return next();
  }

  logSecurityEvent({
    userId: req.user?.id || null,
    ipAddress: req.ip || req.connection?.remoteAddress,
    eventType: 'CSRF_ATTEMPT',
    endpoint: req.originalUrl,
    metadata: JSON.stringify({ method: req.method })
  }).catch(() => {});

  return res.status(403).json({ message: 'Invalid CSRF token.' });
};

export default {
  ipRateLimiter,
  logSecurityEvent,
  logAuthFailure,
  generateCsrfToken,
  validateCsrfToken
};