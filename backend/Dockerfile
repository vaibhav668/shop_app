# Bada Bazar API — production image.
# Built by deploy/docker-compose.yml; runs migrations, then the API, as a non-root user.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# media/ is only used with local photo storage (development and smoke tests).
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/media && chown appuser /app/media
USER appuser

EXPOSE 8000

# Only the reverse proxy can reach this container (no published port), so forwarded headers
# from it are trusted; that gives rate limits the real client IP.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*' --no-server-header"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/db', timeout=4).status == 200 else 1)"
