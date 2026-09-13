# Dev image — favors fast iteration (nodemon + bind mount) over a small final size.
# The production, multi-stage version of this file is built in Phase 19.
#
# node:20-slim (Debian), NOT node:20-alpine: onnxruntime-node — a dependency
# of @xenova/transformers, used for local embeddings — ships a prebuilt
# native binary linked against glibc. Alpine uses musl libc instead, so the
# binary fails to load at runtime (ld-linux-x86-64.so.2: No such file or
# directory) and crashes the whole process the first time embeddings are
# generated, not at build time — this only surfaces when /process actually
# runs. Alpine's glibc-compatibility packages are explicitly documented as
# "experimental" and unreliable for this class of problem, so switching the
# base image is the correct fix, not a workaround.
FROM node:20-slim

WORKDIR /usr/src/app

# Install deps first so this layer is cached unless package.json changes
COPY package*.json ./

# --os/--cpu forces npm to fetch the Linux x64 build of native optional
# dependencies (sharp, onnxruntime-node, @napi-rs/canvas via pdf-parse)
# regardless of what platform generated the committed package-lock.json.
# This is sharp's own documented fix for exactly this scenario: "building
# your deployment package on a machine that differs from the target" —
# our lockfile was generated on Windows, this container runs Linux.
RUN npm install --os=linux --cpu=x64

# Source is bind-mounted over this in docker-compose.dev.yml,
# this COPY just makes the image runnable standalone too.
COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]