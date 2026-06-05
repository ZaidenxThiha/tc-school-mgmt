# face-engine

Stateless InsightFace sidecar for the Thazin & Cherry attendance system.
Image bytes → face detections + 512-d ArcFace embeddings (`buffalo_l`). It holds
**no database**, **no identities**, and **stores no images** — the Next.js app
(`../app`) does all auth, matching (pgvector), attendance logic and storage.

Vercel cannot run this (Python + ~300 MB ONNX models). Deploy it separately
(Railway / Render / Fly.io / a small VPS) and point the app at it via
`FACE_ENGINE_URL` + `FACE_ENGINE_TOKEN`.

## API

`GET /health` → `{ ok, model }`

`POST /embed` (requires `Authorization: Bearer $FACE_ENGINE_TOKEN`)
```json
// request
{ "image": "<base64 jpeg/png, data: URL prefix tolerated>" }
// response
{ "faces": [ {
  "bbox": [x, y, w, h],
  "det_score": 0.99,
  "embedding": [ /* 512 L2-normalized floats */ ],
  "quality": { "size_px": 120, "blur": 42.1, "brightness": 0.6, "pose_ok": true }
} ] }
```

## Run locally

```bash
cd face-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export FACE_ENGINE_TOKEN=dev-secret      # required — service fails closed without it
uvicorn main:app --reload --port 8000
```

First start downloads the `buffalo_l` pack to `~/.insightface`.

## Run with Docker

```bash
docker build -t face-engine ./face-engine
docker run -p 8000:8000 -e FACE_ENGINE_TOKEN=dev-secret face-engine
```

## Environment

| Var | Default | Notes |
|---|---|---|
| `FACE_ENGINE_TOKEN` | — | **Required.** Shared bearer; must match the app's `FACE_ENGINE_TOKEN`. |
| `FACE_MODEL_NAME` | `buffalo_l` | InsightFace model pack. |
| `FACE_DET_SIZE` | `640` | Detector input size. |
| `FACE_CTX_ID` | `-1` | `-1` CPU, `0` first GPU. |
| `FACE_MAX_IMAGE_BYTES` | `8388608` | Reject larger decoded payloads. |
| `PORT` | `8000` | Listen port. |

## Privacy

Images are decoded in memory and dropped at the end of the request. No disk
writes, no pixel logging. Only embeddings (not reversible to a photo) leave the
service, and only to the app server over the authenticated channel.
