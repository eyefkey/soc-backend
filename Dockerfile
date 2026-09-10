FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 4000

# Baked into the image itself, not left to docker-compose's `command:`
# override — a platform that runs this Dockerfile directly (Render, Fly,
# etc.) never sees compose-specific overrides, only what's declared here.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
