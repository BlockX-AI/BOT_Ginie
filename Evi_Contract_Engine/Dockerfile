FROM node:20-alpine

WORKDIR /app

# Single-stage runtime image. We rely on vendored api/artifacts for ABIs
# and do not compile contracts at build time to avoid failing on extraneous sources.

# Install curl for healthcheck
RUN apk add --no-cache curl

# Install only production deps for runtime.
# Use `npm install` (not `npm ci`) because package-lock.json is gitignored in
# this repo and therefore not present in the build context.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source
COPY api/ ./api/
COPY scripts/ ./scripts/
COPY contracts/ ./contracts/
COPY hardhat.config.js ./

# Ensure Hardhat artifacts exist in the image. Runtime compile is disabled in Railway.
RUN npx hardhat compile

## No builder artifacts; server prefers api/artifacts vendored in repo

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    HARDHAT_DISABLE_TELEMETRY=1 \
    DISABLE_RUNTIME_COMPILE=1

# Expose port
EXPOSE 3000

# Healthcheck to ensure server is responding (use $PORT or default 3000)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 \
  CMD sh -c 'curl -fsS "http://localhost:${PORT:-3000}/" || exit 1'

# Start server
CMD ["node", "api/server.js"]
