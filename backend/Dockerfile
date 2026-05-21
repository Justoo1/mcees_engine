FROM python:3.11-slim

WORKDIR /app

RUN pip install uv

# Copy deps manifest first for layer caching, then source
COPY pyproject.toml .
COPY . .

RUN uv pip install --system ".[dev]"

ENV PYTHONPATH=/app

EXPOSE 8000
