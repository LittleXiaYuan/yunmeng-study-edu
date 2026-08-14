# Next.js static export → nginx (admin / teacher / student in one SPA)
FROM node:20-alpine AS builder
WORKDIR /src

# Browser-facing API origin (absolute URL). Empty/same-origin only works when
# this container is reverse-proxied on the same host as the Go API.
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18080
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/out /usr/share/nginx/html
EXPOSE 80
