FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN go build -o /out/edu-server ./cmd/edu-server

FROM alpine:3.20
WORKDIR /app
ENV EDU_ADDR=:18080
ENV EDU_STORAGE_DRIVER=sqlite
ENV EDU_SQLITE_PATH=/app/data/study.db
COPY --from=builder /out/edu-server /app/edu-server
EXPOSE 18080
CMD ["/app/edu-server"]
