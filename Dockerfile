FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5174
ENV ASPAPI_DATA_DIR=/app/storage
ENV TRUST_PROXY=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.js cms-model.js content.seed.json ./
COPY server ./server
COPY scripts/admin-account.js scripts/backup.js ./scripts/
COPY ["Logo ASPAPI SULSEL.jpg", "./"]
RUN mkdir -p /app/storage/uploads /app/backups
RUN chown -R node:node /app
USER node
EXPOSE 5174
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(response=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]