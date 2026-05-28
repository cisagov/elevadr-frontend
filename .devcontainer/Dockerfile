FROM node:22-bookworm AS dev

# Copy certs (expect the PEM file(s) in .devcontainer/certs/)
COPY .devcontainer/certs/ /tmp/certs/

# Handle custom certificates for Debian/Bookworm
RUN set -eu; \
    if [ -n "$(ls -A /tmp/certs 2>/dev/null)" ]; then \
      # In Debian, we append to the ca-certificates bundle
      cat /tmp/certs/* > /usr/local/share/ca-certificates/custom-bundle.crt && \
      update-ca-certificates; \
      npm config set cafile "/etc/ssl/certs/ca-certificates.crt"; \
    fi

# Ensure the environment knows where the bundle is
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Install system dependencies using apt-get
# Note: 'build-base' (Alpine) becomes 'build-essential' (Debian)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    python3 \
    python3-pip \
    nginx \
    build-essential \
    docker-compose \
    sudo \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Configure sudo for the node user
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER node

# Allow pip to install packages globally in the container
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Add local bin to path in bashrc
RUN echo "export PATH=\$HOME/.local/bin:\$PATH" >> ~/.bashrc

WORKDIR /workspace
EXPOSE 3000 80

CMD ["sleep", "infinity"]
