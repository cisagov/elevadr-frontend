FROM node:25-alpine AS dev

# Copy certs (expect the PEM file(s) in .devcontainer/certs/)
COPY .devcontainer/certs/ /tmp/certs/

# If you have multiple files, we concatenate into one bundle for apk.
RUN set -eu; \
    if [ -n "$(ls -A /tmp/certs 2>/dev/null)" ]; then \
      cat /tmp/certs/* > /etc/ssl/certs/custom-bundle.pem; \
    fi

# Ensure apk uses the bundle for TLS verification during the bootstrap phase
ENV SSL_CERT_FILE=/etc/ssl/certs/custom-bundle.pem

# Now apk should work
RUN apk update && apk add --no-cache ca-certificates \
  && update-ca-certificates

RUN apk add --no-cache \
    git \
    bash \
    python3 \
    py3-pip \
    nginx \
    build-base \
    docker-compose-plugin \
    sudo \
    ssh

USER node
WORKDIR /workspace
EXPOSE 3000 80
CMD ["sleep", "infinity"]
