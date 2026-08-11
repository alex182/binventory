FROM python:3.12-slim

# Node 20 via NodeSource, plus general dev tooling.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        git \
        file \
        ca-certificates \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pytest ruff

WORKDIR /workspace
