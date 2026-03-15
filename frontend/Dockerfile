FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy app code
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
