FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Generate Prisma client
COPY backend/prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY backend/ .

EXPOSE 4000

CMD ["node", "index.js"]