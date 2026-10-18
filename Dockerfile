FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY milesight.js runtime.js sensor-profiles.js downlink.js firebase-setup.html firebase-setup.js firebase.json firestore.rules firestore.indexes.json ./
ENV NODE_ENV=production
# Runtime state (.env, firebase.local.json, serviceAccountKey.json) lives in /data
WORKDIR /data
RUN chown node:node /data
USER node
VOLUME /data
EXPOSE 1883 8883 8080
CMD ["node", "/app/milesight.js"]
