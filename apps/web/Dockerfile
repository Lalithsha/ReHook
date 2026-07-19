# Use official Bun Alpine Linux image for Next.js Dashboard
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Copy package lockfiles
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN bun install

# Copy web app source code
COPY apps/web ./apps/web/

WORKDIR /app/apps/web

# Build Next.js static production bundle
RUN bun run build

EXPOSE 3000

CMD ["bun", "start"]
