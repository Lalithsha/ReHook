# Use official Bun Alpine Linux image
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Copy root package.json and bun.lock if present
COPY package.json bun.lock* ./

# Copy apps/api package files
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install dependencies across workspace
RUN bun install

# Copy apps/api source code
COPY apps/api ./apps/api/

# Generate Prisma Client
WORKDIR /app/apps/api
RUN bun db:generate

EXPOSE 3001

# Default command to start API server
CMD ["bun", "src/server.ts"]
