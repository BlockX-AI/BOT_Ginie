const pino = require('pino');
const fs = require('fs');
const path = require('path');

// LOG_LEVEL=trace|debug|info|warn|error|fatal
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Redact sensitive fields if ever logged as properties
const redact = {
  paths: [
    // env-like keys (if passed into logs)
    'GEMINI_API_KEY',
    'BASECAMP_PRIVATE_KEY',
    'CAMP_PRIVATE_KEY',
    'DEPLOYMENT_DATA',
    // common locations
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.apiKey',
    'req.body.privateKey',
  ],
  censor: '[REDACTED]'
};

// Build transport(s)
const wantFile = String(process.env.LOG_TO_FILE || '') === '1';
let transport;
if (wantFile) {
  // Ensure logs directory exists
  const destDir = path.join(process.cwd(), 'logs');
  try { fs.mkdirSync(destDir, { recursive: true }); } catch (_) {}
  const destFile = path.join(destDir, 'api.log');
  transport = pino.transport({
    targets: [
      // Human-friendly pretty stream for local dev
      ...(process.env.NODE_ENV === 'production' ? [] : [{
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', singleLine: false, ignore: 'pid,hostname' },
        level
      }]),
      // JSON file for persistence/analysis
      {
        target: 'pino/file',
        options: { destination: destFile },
        level
      }
    ]
  });
} else if (process.env.NODE_ENV !== 'production') {
  transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', singleLine: false, ignore: 'pid,hostname' }
  });
}

const logger = pino({ level, redact }, transport);

module.exports = logger;
