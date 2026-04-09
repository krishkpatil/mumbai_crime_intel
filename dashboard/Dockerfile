FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_API_URL is baked in at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public        ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static  ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
