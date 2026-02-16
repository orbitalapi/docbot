FROM node:20-slim

# Install git (required for cloning repos)
RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create directory for git clones
RUN mkdir -p /tmp/doc-bot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run the service
CMD ["node", "dist/index.js"]
