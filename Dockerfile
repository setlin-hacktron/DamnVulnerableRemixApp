FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

RUN mkdir -p data/receipts

EXPOSE 3000

ENV NODE_ENV=production
ENV SESSION_SECRET=s3cr3t-d3f4ult-k3y

CMD ["npm", "start"]
