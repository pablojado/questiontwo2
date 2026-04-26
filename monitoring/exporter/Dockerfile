FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 9464
CMD ["npm", "start"]
