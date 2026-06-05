"""Face-engine sidecar for the Thazin & Cherry app.

A stateless microservice: image bytes -> InsightFace (buffalo_l) detections +
512-d ArcFace embeddings. It holds NO database connection and NO identities — it
never knows who anyone is. The Next.js app does all auth, matching (pgvector),
attendance logic and storage. Images are processed in memory and discarded
immediately; nothing is written to disk or logged.

Auth: every request must carry `Authorization: Bearer <FACE_ENGINE_TOKEN>`.
Only the Next.js server calls this — never the browser directly.
"""

import base64
import os

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

# InsightFace + OpenCV are heavy; import lazily so the module can be linted
# without the model pack present.
import cv2  # noqa: E402
from insightface.app import FaceAnalysis  # noqa: E402

ENGINE_TOKEN = os.environ.get("FACE_ENGINE_TOKEN", "")
MODEL_NAME = os.environ.get("FACE_MODEL_NAME", "buffalo_l")
# Detector input size; bigger = more accurate on small/distant faces, slower.
DET_SIZE = int(os.environ.get("FACE_DET_SIZE", "640"))
MAX_IMAGE_BYTES = int(os.environ.get("FACE_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))

app = FastAPI(title="face-engine", version="1.0")

# Loaded once at startup (see lifespan below).
_engine: FaceAnalysis | None = None


@app.on_event("startup")
def _load_model() -> None:
    global _engine
    engine = FaceAnalysis(name=MODEL_NAME)
    # ctx_id=-1 => CPU. Set FACE_CTX_ID=0 to use the first GPU if available.
    engine.prepare(ctx_id=int(os.environ.get("FACE_CTX_ID", "-1")), det_size=(DET_SIZE, DET_SIZE))
    _engine = engine


def _require_token(authorization: str | None = Header(default=None)) -> None:
    """Reject anything without the shared bearer token."""
    if not ENGINE_TOKEN:
        # Fail closed: refuse to run unauthenticated in any environment.
        raise HTTPException(status_code=500, detail="FACE_ENGINE_TOKEN is not configured")
    expected = f"Bearer {ENGINE_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class EmbedRequest(BaseModel):
    # Base64-encoded JPEG/PNG. A data: URL prefix is tolerated and stripped.
    image: str


class FaceQuality(BaseModel):
    size_px: int
    blur: float
    brightness: float
    pose_ok: bool


class DetectedFace(BaseModel):
    bbox: list[int]  # [x, y, w, h]
    det_score: float
    embedding: list[float]  # 512 floats, L2-normalized
    quality: FaceQuality


class EmbedResponse(BaseModel):
    faces: list[DetectedFace]


@app.get("/health")
def health() -> dict:
    return {"ok": _engine is not None, "model": MODEL_NAME}


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(_require_token)])
def embed(req: EmbedRequest) -> EmbedResponse:
    if _engine is None:  # startup not finished
        raise HTTPException(status_code=503, detail="Model not ready")

    raw = req.image
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image missing or too large")

    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Unsupported or corrupt image")

    faces = _engine.get(img)
    out: list[DetectedFace] = []
    for f in faces:
        x1, y1, x2, y2 = (int(v) for v in f.bbox)
        w, h = max(0, x2 - x1), max(0, y2 - y1)
        emb = np.asarray(f.normed_embedding, dtype=np.float32)  # already L2-normalized

        # Cheap quality signals for the app's quality gate.
        crop = img[max(0, y1): y2, max(0, x1): x2]
        if crop.size:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            brightness = float(gray.mean()) / 255.0
        else:
            blur, brightness = 0.0, 0.0
        # pose: insightface exposes yaw/pitch/roll via f.pose when available.
        pose_ok = True
        pose = getattr(f, "pose", None)
        if pose is not None and len(pose) >= 2:
            yaw, pitch = float(pose[0]), float(pose[1])
            pose_ok = abs(yaw) <= 35.0 and abs(pitch) <= 35.0

        out.append(
            DetectedFace(
                bbox=[x1, y1, w, h],
                det_score=float(f.det_score),
                embedding=emb.tolist(),
                quality=FaceQuality(size_px=min(w, h), blur=blur, brightness=brightness, pose_ok=pose_ok),
            )
        )

    # `img`, `data`, `crop` go out of scope here; nothing is persisted.
    return EmbedResponse(faces=out)
