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
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response as FastResponse
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

# Browsers call this engine directly from the site (browser-direct mode), so it
# needs CORS. Default allows the deployed site + local dev; override with a
# comma-separated FACE_ALLOW_ORIGINS, or "*" for any.
_default_origins = "https://tncengcenter.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
ALLOW_ORIGINS = [o.strip() for o in os.environ.get("FACE_ALLOW_ORIGINS", _default_origins).split(",") if o.strip()]

app = FastAPI(title="face-engine", version="1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ORIGINS == ["*"] else ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    """Chrome's Private Network Access: a request from an HTTPS (public) page to a
    local address (127.0.0.1) sends a CORS preflight asking permission to reach the
    private network. Answer it so the browser allows the call."""
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network") == "true":
        resp = FastResponse(status_code=204)
        origin = request.headers.get("origin", "*")
        allow = "*" if ALLOW_ORIGINS == ["*"] else (origin if origin in ALLOW_ORIGINS else ALLOW_ORIGINS[0])
        resp.headers["Access-Control-Allow-Origin"] = allow
        resp.headers["Access-Control-Allow-Methods"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        resp.headers["Access-Control-Allow-Private-Network"] = "true"
        return resp
    return await call_next(request)

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
    """If a token is configured, require it. When FACE_ENGINE_TOKEN is unset the
    engine runs token-less for browser-direct LOCAL use — safe because it binds to
    127.0.0.1, so only this machine (incl. its browser) can reach it. Set a token
    if you ever expose the engine beyond localhost."""
    if not ENGINE_TOKEN:
        return
    if authorization != f"Bearer {ENGINE_TOKEN}":
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
