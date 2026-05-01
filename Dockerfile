# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files from the src/ directory
COPY src/package*.json ./

# Install dependencies
# Mount the cert secret for npm's SSL verification
RUN --mount=type=secret,id=ssl_cert,required=false \
    if [ -f /run/secrets/ssl_cert ]; then \
        npm config set cafile /run/secrets/ssl_cert; \
    fi && \
    npm ci --omit=dev

# Copy public assets
COPY src/public/ ./public

# Copy source code
COPY src/app ./src
COPY src/tsconfig.json ./

# Build the application
RUN --mount=type=secret,id=ssl_cert,required=false \
    if [ -f /run/secrets/ssl_cert ]; then \
        npm config set cafile /run/secrets/ssl_cert; \
    fi && \
    npm run build

# Production stage
FROM nginxinc/nginx-unprivileged:alpine-perl

# Switch to root for setup
USER root

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

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


