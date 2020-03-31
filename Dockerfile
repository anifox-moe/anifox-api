from mhart/alpine-node:12

RUN apk update

RUN apk add python

RUN apk add --update alpine-sdk

RUN apk add netcat-openbsd

RUN yarn global add node-gyp

WORKDIR /usr/src/anifox-api

COPY . .

ADD https://raw.githubusercontent.com/eficode/wait-for/master/wait-for /usr/src/anifox-api/wait-for
RUN chmod +x /usr/src/anifox-api/wait-for

RUN yarn

EXPOSE 3000

CMD ["yarn", "run", "start"]
