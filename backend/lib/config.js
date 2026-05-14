/**
 * Centralized API and environment configuration.
 * All API URLs and environment variables should be referenced here.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Base URLs
const API_BASE = process.env.BACKEND_API_URL || (IS_PRODUCTION ? 'https://api.clinicflow.app' : 'http://localhost:4000/api');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://clinicflows.vercel.app';

// SMS / Communication
const SMS_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || process.env.SMS_WEBHOOK_URL || process.env.WEBHOOK_URL || '';

// Limits with environment variable overrides
const SMS_MONTHLY_LIMIT = Number(process.env.SMS_MONTHLY_LIMIT) || 500;
const AI_MONTHLY_LIMIT = Number(process.env.AI_MONTHLY_LIMIT) || 1000;
const DAILY_SMS_LIMIT = Number(process.env.DAILY_SMS_LIMIT) || 200;
const SMS_BURST_LIMIT = Number(process.env.SMS_BURST_LIMIT) || 12;

// Auth
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH) || 8;

// Rate limiting
const GLOBAL_SMS_PER_HOUR_LIMIT = Number(process.env.GLOBAL_SMS_PER_HOUR_LIMIT) || 2000;
const NEW_CLINIC_SMS_PER_HOUR_LIMIT = Number(process.env.NEW_CLINIC_SMS_PER_HOUR_LIMIT) || 50;
const SMS_PER_MINUTE_LIMIT = Number(process.env.SMS_PER_MINUTE_LIMIT) || 40;
const AI_PER_MINUTE_LIMIT = Number(process.env.AI_PER_MINUTE_LIMIT) || 30;
const TEMP_SPIKE_BLOCK_MS = Number(process.env.TEMP_SPIKE_BLOCK_MS) || (5 * 60 * 1000);

// Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test';

// Required env vars
const REQUIRED_VARS = [
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'DATABASE_URL',
  'DB_ENCRYPTION_KEY',
];

function validateConfig() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    const missingStr = missing.join(', ');
    if (IS_PRODUCTION) {
      throw new Error(`FATAL: Missing required environment variables: ${missingStr}`);
    }
    console.warn(`[Config] WARNING: Missing env vars (OK in dev): ${missingStr}`);
  }
}

module.exports = {
  IS_PRODUCTION,
  API_BASE,
  FRONTEND_URL,
  SMS_WEBHOOK_URL,
  SMS_MONTHLY_LIMIT,
  AI_MONTHLY_LIMIT,
  DAILY_SMS_LIMIT,
  SMS_BURST_LIMIT,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  PASSWORD_MIN_LENGTH,
  GLOBAL_SMS_PER_HOUR_LIMIT,
  NEW_CLINIC_SMS_PER_HOUR_LIMIT,
  SMS_PER_MINUTE_LIMIT,
  AI_PER_MINUTE_LIMIT,
  TEMP_SPIKE_BLOCK_MS,
  REDIS_URL,
  REDIS_DISABLED,
  validateConfig,
};