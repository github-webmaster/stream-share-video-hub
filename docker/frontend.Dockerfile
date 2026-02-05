FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* bun.lockb* ./
RUN npm install

COPY . .

ARG VITE_API_URL
ARG VITE_MEDIA_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MEDIA_URL=$VITE_MEDIA_URL

RUN npm run build

FROM nginx:alpine
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
