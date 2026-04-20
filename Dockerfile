# Base Image - Node.js Windows image
FROM node:18-windowsservercore-ltsc2022

# Disable Git warning about line endings in Windows
ENV GIT_LFS_SKIP_SMUDGE=1
RUN git config --global core.autocrlf true

# Install environment tools - use taobao mirror for faster install
RUN npm config set registry https://registry.npmmirror.com ; `
npm install -g yarn vite

# Set working directory
WORKDIR C:\app

# Copy package files and install dependencies first (layer caching)
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile 2>&1

# Copy all project content
COPY . .

# Build preconstruct packages (link workspaces)
RUN yarn dev 2>&1

# Expose Vite dev server port
EXPOSE 5173

# Environment variables to ensure Vite binds correctly
ENV HOST=0.0.0.0
ENV PORT=5173

# Start the actual dev server - NOT just cmd.exe
# Directly call workspace command to ensure parameter passing
CMD ["yarn", "workspace", "example", "dev", "--host", "0.0.0.0", "--port", "5173"]
