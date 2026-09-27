FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --production
COPY . .
EXPOSE 10000
ENV PORT=10000
ENV NODE_ENV=production
CMD ["node", "server/server.js"]
