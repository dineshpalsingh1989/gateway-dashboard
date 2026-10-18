FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY milesight.js firebase-setup.html firebase-setup.js firebase.json firestore.rules firestore.indexes.json ./
ENV NODE_ENV=production
EXPOSE 1883 8883 8080
CMD ["node", "milesight.js"]
