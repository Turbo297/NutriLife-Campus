FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production PORT=8080
CMD ["node", "server.js"]
