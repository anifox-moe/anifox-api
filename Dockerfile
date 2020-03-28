from mhart/alpine-node:12

RUN apk update

RUN apk add python

RUN apk add --update alpine-sdk

RUN yarn global add node-gyp

WORKDIR /usr/src/anifox-api

COPY . .

RUN yarn

EXPOSE 3000

CMD ["yarn", "run", "start"]
