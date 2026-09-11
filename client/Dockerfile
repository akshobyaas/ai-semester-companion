# Dev image for the real Vite + React app (placeholder from Phase 1 replaced in Phase 15).
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
