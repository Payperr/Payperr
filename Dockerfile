# Payper public read-only site as a container (ALTERNATIVE to Render's native Node runtime).
# NOT BUILT OR TESTED: Docker was not available on the build machine. No image is published anywhere;
# your host builds it from this file.
FROM node:24-alpine
WORKDIR /app
# Only what the server needs. Tests, docs, preview and local data are not copied.
COPY package.json paper.config.json ./
COPY server ./server
COPY public ./public
ENV NODE_ENV=production \
    PAYPER_MODE=public \
    DATA_DIR=/data \
    PORT=8080
# The paper record lives in /data; mount a persistent volume/disk there.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
# PUBLIC_ORIGIN (or Render's RENDER_EXTERNAL_URL) must be provided at run time. TOKEN_MINT is optional.
CMD ["node", "server/server.mjs"]
