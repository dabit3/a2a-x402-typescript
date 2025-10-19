# Single-stage build for x402 Merchant Agent
# Note: Using single-stage to avoid case-sensitivity issues with adk-typescript on Linux
FROM node:20-alpine

# Set working directory
WORKDIR /

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Fix case-sensitivity issues in adk-typescript package
# The package has incorrect casing in requires that works on macOS but fails on Linux
RUN cd /node_modules/adk-typescript/dist/sessions && \
    ln -s state.js State.js 2>/dev/null || true && \
    ln -s state.d.ts State.d.ts 2>/dev/null || true && \
    ln -s baseSessionService.js BaseSessionService.js 2>/dev/null || true && \
    ln -s baseSessionService.d.ts BaseSessionService.d.ts 2>/dev/null || true && \
    ln -s inMemorySessionService.js InMemorySessionService.js 2>/dev/null || true && \
    ln -s inMemorySessionService.d.ts InMemorySessionService.d.ts 2>/dev/null || true && \
    ln -s databaseSessionService.js DatabaseSessionService.js 2>/dev/null || true && \
    ln -s databaseSessionService.d.ts DatabaseSessionService.d.ts 2>/dev/null || true && \
    cd /node_modules/adk-typescript/dist/tools && \
    ln -s toolContext.js ToolContext.js 2>/dev/null || true && \
    ln -s toolContext.d.ts ToolContext.d.ts 2>/dev/null || true

# Copy environment example file for reference (if not already copied)
RUN cp -n .env.example . || true

# Remove TypeScript source files to reduce image size (keep compiled .js files)
RUN find . -name "*.ts" -not -path "./node_modules/*" -delete && \
    rm -f tsconfig.json

# Expose port (default 10000, configurable via PORT env var)
EXPOSE 10000

# Set environment variables defaults
ENV NODE_ENV=production
ENV PORT=10000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/health', (r) => {let data='';r.on('data',c=>data+=c);r.on('end',()=>process.exit(r.statusCode===200&&JSON.parse(data).status==='ok'?0:1))})"

# Run the application
CMD ["node", "server.js"]
