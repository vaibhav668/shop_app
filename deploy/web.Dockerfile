# The two websites, built once and served by Caddy:
#   shop.<domain>  — the customer web app (its Welcome page is the one sign-in page) + legal pages
#   admin.<domain> — the admin dashboard
# Build context: the repository root (see docker-compose.yml).

# --- customer web app (Expo export) ---
FROM node:22-slim AS shop
WORKDIR /src/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY mobile/ ./
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
ARG EXPO_PUBLIC_ADMIN_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
    EXPO_PUBLIC_ADMIN_URL=$EXPO_PUBLIC_ADMIN_URL
RUN npx expo export --platform web --output-dir /out/shop

# --- admin dashboard (Vite) ---
FROM node:22-slim AS admin
WORKDIR /src/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin/ ./
ARG VITE_API_URL
ARG VITE_SHOP_URL
ENV VITE_API_URL=$VITE_API_URL VITE_SHOP_URL=$VITE_SHOP_URL
RUN npm run build && cp -r dist /out-admin

# --- server ---
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=shop /out/shop /srv/shop
COPY deploy/legal /srv/shop/legal
COPY --from=admin /out-admin /srv/admin
