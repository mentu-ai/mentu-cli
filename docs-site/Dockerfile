FROM node:20-alpine
WORKDIR /app
COPY kb-server.cjs .
COPY dist/ ./dist/
ENV KB_PORT=3457
ENV KB_BASE_PATH=/knowledge-base
ENV KB_DIST_DIR=./dist
EXPOSE 3457
CMD ["node", "kb-server.cjs"]
