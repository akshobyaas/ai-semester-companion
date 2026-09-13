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
# dependencies (like @napi-rs/canvas, pulled in via pdf-parse) regardless
# of what platform generated the committed package-lock.json.
RUN npm install --os=linux --cpu=x64

# sharp@0.32.6 (a transitive dependency) predates the modern per-platform
# @img/sharp-* package split and has NO optionalDependencies at all — the
# --os/--cpu flags above do nothing for it. It installs its native binary
# via a postinstall script (prebuild-install), which is what actually
# needs to target linux/x64 explicitly. Verified directly: without this
# line, sharp's binary is missing at require-time; with it, sharp loads
# correctly. This is the exact command sharp's own runtime error message
# recommends for this situation.
RUN npm install --platform=linux --arch=x64 sharp

# Source is bind-mounted over this in docker-compose.dev.yml,
# this COPY just makes the image runnable standalone too.
COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]