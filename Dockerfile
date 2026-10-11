FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN OPENINN_STANDALONE=1 npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/app/data/openinn.db \
    PROPERTIES_DIR=/app/properties
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY properties ./properties
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
