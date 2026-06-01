FROM node:20-alpine
WORKDIR /app

# 1. Root deps (express, discord.js, mongoose, etc.) — used by bot + API
COPY package*.json ./
RUN npm ci --ignore-scripts

# 2. Workspace deps (webapp + shared)
COPY Chameleon/package*.json Chameleon/
COPY Chameleon/webapp/package*.json Chameleon/webapp/
COPY Chameleon/shared/package*.json Chameleon/shared/
RUN cd Chameleon && npm ci --ignore-scripts

# 3. Activity deps (own node_modules)
COPY Chameleon/activity/package*.json Chameleon/activity/
RUN cd Chameleon/activity && npm ci --ignore-scripts

# 4. Source code
COPY . .

# 5. Build activity
RUN cd Chameleon/activity && npm run build && cp -r .robo/public dist
