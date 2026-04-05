# Build stage
FROM node:20-bookworm AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app

# Copy production files
COPY --from=builder /app/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    MAX_CONCURRENCY=5

EXPOSE 3000

# Use the official playwright entrypoint or just node
CMD ["node", "dist/index.js"]
