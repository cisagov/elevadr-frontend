# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files from the src/ directory
COPY package*.json pnpm-* ./

# Install dependencies
# Mount the cert secret for npm's SSL verification
RUN --mount=type=secret,id=ssl_cert,required=false \
    if [ -f /run/secrets/ssl_cert ]; then \
        npm config set cafile /run/secrets/ssl_cert; \
    fi && \
    npm install -g pnpm

RUN --mount=type=secret,id=ssl_cert,required=false \
    if [ -f /run/secrets/ssl_cert ]; then \
        pnpm config set cafile /run/secrets/ssl_cert; \
    fi && \
    pnpm ci

# Copy public assets
COPY src/public/ ./public

# Copy source code
COPY src/app ./src
COPY tsconfig.json vite.config.ts ./
COPY src/index.html .

# Build the application
RUN --mount=type=secret,id=ssl_cert,required=false \
    pnpm run build

# Production stage
FROM nginxinc/nginx-unprivileged:alpine-perl

# Switch to root for setup
USER root

RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY src/nginx.conf /etc/nginx/conf.d/default.conf

# Create input directory for mounted reports and switch ownership to the nginx user:group
RUN mkdir -p /usr/share/nginx/html/input \
    && chown -R nginx:nginx /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Switch to the non-root 'nginx' user for execution
USER nginx

CMD ["nginx", "-g", "daemon off;"]
