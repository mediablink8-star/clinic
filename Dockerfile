# Build stage for frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build stage for backend
FROM node:22-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy backend source
COPY backend/ ./backend/
RUN cd backend && npx prisma generate

# Copy built frontend to backend static folder (if needed, otherwise served separately)
# For this SaaS, we might serve them separately in compose, but let's copy to backend/public for convenience
RUN mkdir -p backend/public
COPY --from=frontend-build /app/frontend/dist ./backend/public

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>r.json()).then(d=>process.exit(d.status==='ok'?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/backend
CMD ["npm", "run", "deploy"]
