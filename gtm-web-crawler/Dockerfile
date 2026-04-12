# Specify the base Docker image. You can read more about
# the available images at https://crawlee.dev/docs/guides/docker-images
# You can also use any other image from Docker Hub.
FROM apify/actor-node-playwright-camoufox:24-1.58.2 AS builder

# Install prerequisites for Bun
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*
USER myuser

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/home/myuser/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Copy dependency manifests first to leverage Docker layer cache.
COPY --chown=myuser package.json ./

# Install all dependencies.
RUN bun install

# Next, copy the source files using the user set
# in the base image.
COPY --chown=myuser . ./

# Build the project.
RUN bun run build

# Create final image
FROM apify/actor-node-playwright-camoufox:24-1.58.2

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/home/myuser/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Copy built output from builder image
COPY --from=builder --chown=myuser /home/myuser/dist ./dist

# Copy dependency manifests first to leverage Docker layer cache.
COPY --chown=myuser package.json ./

# Install production dependencies only and print versions for debugging
RUN bun install --production \
    && echo "Installed Bun packages:" \
    && (bun pm ls || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "Bun version:" \
    && bun --version

# Copy the source files and directories.
COPY --chown=myuser . ./

# Run the image.
CMD ["bun", "run", "start:prod"]