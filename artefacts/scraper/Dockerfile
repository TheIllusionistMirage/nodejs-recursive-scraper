FROM node:alpine

EXPOSE 3306
WORKDIR /app

# Copy the source code
COPY src ./src

# Copy package.json and package-loack.json
COPY package*.json ./

# Copy TS config and lint settings
COPY ts*.json ./

# Install packages
RUN npm install --quiet

# Generate build
RUN npm run build

CMD ["node", "dist/index.js"]
