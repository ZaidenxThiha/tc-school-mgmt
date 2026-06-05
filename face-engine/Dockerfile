# Face-engine sidecar — InsightFace buffalo_l behind FastAPI.
# CPU image. For GPU, swap the base for an onnxruntime-gpu/CUDA image and set
# FACE_CTX_ID=0.
FROM python:3.11-slim

# System libs InsightFace/OpenCV need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model pack at build time so the first request isn't slow.
# (~300 MB; baked into the image.)
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1, det_size=(640,640))"

COPY main.py .

ENV PORT=8000
EXPOSE 8000

# FACE_ENGINE_TOKEN must be provided at runtime (the service fails closed without it).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
