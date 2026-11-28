# Not built or deployed yet. CPU only; no GPU runtime.
FROM python:3.12-slim
RUN useradd --system --uid 10091 blur && apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY redact.py server.py fetch_models.sh ./
RUN ./fetch_models.sh /app/models
ENV SUPERCARGO_BLUR_MODELS=/app/models SUPERCARGO_BLUR_HOST=0.0.0.0 SUPERCARGO_BLUR_PORT=8791 CUDA_VISIBLE_DEVICES=""
USER blur
EXPOSE 8791
CMD ["python", "server.py"]
