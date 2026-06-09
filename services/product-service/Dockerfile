FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
RUN chown -R appuser:appgroup /app
USER appuser
ENV NODE_ENV=production PORT=3002
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "src/index.js"]
