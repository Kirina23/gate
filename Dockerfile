FROM node:lts

WORKDIR /usr/src/app/
# COPY package*.json ./

CMD ["npm", "run", "start"]