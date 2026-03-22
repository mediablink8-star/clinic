# Build stage for frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build stage for backend
FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend to backend static folder (if needed, otherwise served separately)
# For this SaaS, we might serve them separately in compose, but let's copy to backend/public for convenience
RUN mkdir -p backend/public
COPY --from=frontend-build /app/frontend/dist ./backend/public

EXPOSE 4000
WORKDIR /app/backend
CMD ["npm", "start"]
