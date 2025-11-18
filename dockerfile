FROM oven/bun:1.1 as builder
WORKDIR /app

COPY . .

RUN bun install --no-cache

RUN bun build ./src/server.ts --compile --outfile ./server

FROM debian:bookworm-slim
WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/src/views ./src/views

ENV NODE_ENV=production

EXPOSE 5000

CMD ["./server"]
