# Use the official Bun image
FROM oven/bun:1.3.12 AS base

# Set working directory
WORKDIR /app

# Copy package.json and bun.lock
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build the project (if needed, though Mastra can run in dev or start)
# Mastra start expects the project to be built.
RUN bun run build

# Expose the port (Mastra default is 4111)
EXPOSE 4111

# Run the project
CMD ["bun", "run", "start"]
