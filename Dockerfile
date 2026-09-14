# Multi-stage build for SAMADHAN Portal

# Step 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Step 2: Production Backend & Static Asset Runner
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source code
COPY backend/ ./backend/

# Copy compiled frontend dist from builder stage
COPY --from=frontend-builder /app/frontend/dist ./backend/dist

# Default environment
ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]
