FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq5 curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

# Make start script executable
RUN chmod +x start.sh

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:${PORT}/ || exit 1

# Use start script that runs migrations then starts server
CMD ["./start.sh"]