# Use official Node.js LTS image
FROM mcr.microsoft.com/playwright:v1.47.2-jammy

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Expose Render's PORT
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
