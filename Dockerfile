from alpine-node:12

WORKDIR /usr/src/anifox-api

COPY * *

RUN npm install

EXPOSE 3000

CMD ["npm" "run" "start"]
