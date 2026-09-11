# Dev image — favors fast iteration (nodemon + bind mount) over a small final size.
# The production, multi-stage version of this file is built in Phase 19.
FROM node:20-alpine

WORKDIR /usr/src/app

# Install deps first so this layer is cached unless package.json changes
COPY package*.json ./
RUN npm install

# Source is bind-mounted over this in docker-compose.dev.yml,
# this COPY just makes the image runnable standalone too.
COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]
