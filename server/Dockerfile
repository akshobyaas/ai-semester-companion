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

# DIAGNOSTIC STEP — the previous fix (--platform/--arch) did not resolve
# this, which means the actual failure is something other than what was
# assumed. Running with --verbose --foreground-scripts (sharp's own first
# suggested diagnostic) to surface the real underlying error in the build
# log — likely either a failed download of the prebuilt binary (network
# restriction inside this specific Docker/WSL2 setup) or a failed
# source-compile fallback (node:20-slim has no C++ build tools installed).
# This build is expected to still fail; the point is capturing what it
# says now, not fixing it blind a fourth time.
RUN npm install --ignore-scripts=false --foreground-scripts --verbose --platform=linux --arch=x64 sharp

# Source is bind-mounted over this in docker-compose.dev.yml,
# this COPY just makes the image runnable standalone too.
COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]