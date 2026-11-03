# Stage 1: build the React client (Vite writes to ../backend/static)
FROM node:20-alpine AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Flask API + built client, served by gunicorn
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /build/backend/static ./static
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
