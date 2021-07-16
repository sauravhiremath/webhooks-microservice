FROM node:12.15.0-alpine AS webhooks-service-builder
WORKDIR /home/service/webhooks-service
COPY . ./
RUN yarn install --frozen-lockfile
RUN yarn run build

FROM node:12.15.0-alpine
ENV NODE_ENV=production
WORKDIR /home/service/webhooks-service
COPY --from=webhooks-service-builder /home/service/webhooks-service/build ./build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --no-cache --production
CMD yarn start