# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
# DATABASE_URL placeholder: prisma generate reads the schema but never connects to the DB
RUN DATABASE_URL=postgresql://x:x@x:5432/x npm ci --no-audit

COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
# --ignore-scripts skips postinstall (prisma generate); generated client copied from builder
RUN DATABASE_URL=postgresql://x:x@x:5432/x npm ci --omit=dev --ignore-scripts --no-audit

# Copy generated Prisma client and compiled app from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
