# Multi-stage Dockerfile for SafePay AI
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and client package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci
RUN npm --prefix client ci

# Copy full application code
COPY . .

# Build client production bundle
RUN npm --prefix client run build

# Production Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and prebuilt client dist from builder
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5000

CMD ["node", "server/index.js"]
