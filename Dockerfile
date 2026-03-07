# -- Stage 1: Build --
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# These are needed at build time for SvelteKit's
# $env/static/private imports to be baked in.
# We pass them as build args so they don't live in the image layer.
ARG M3U_URL
ARG EPG_URL
ENV M3U_URL=$M3U_URL
ENV EPG_URL=$EPG_URL

RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# -- Stage 2: Run --
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]