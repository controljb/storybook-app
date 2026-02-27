"""
Storybook Generator — FastAPI Backend
"""
import json
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pipeline.generate import run_images, run_regen_page, run_finalize

app = FastAPI(title="Storybook Generator")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PROJECTS_DIR = Path("/app/projects")
PROJECTS_DIR.mkdir(exist_ok=True)

job_status: dict[str, dict] = {}


def get_project_dir(project_id: str) -> Path:
    p = PROJECTS_DIR / project_id
    p.mkdir(parents=True, exist_ok=True)
    return p


@app.post("/api/projects/new")
def new_project():
    pid = str(uuid.uuid4())[:8]
    get_project_dir(pid)
    return {"project_id": pid}


@app.post("/api/projects/{project_id}/assets")
async def upload_asset(
    project_id: str,
    asset_type: str = Form(...),
    slug: str = Form(...),
    file: UploadFile = File(...),
):
    proj   = get_project_dir(project_id)
    folder = proj / "assets" / f"{asset_type}s"
    folder.mkdir(parents=True, exist_ok=True)
    ext  = Path(file.filename).suffix or ".png"
    dest = folder / f"{slug}{ext}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"ok": True, "path": str(dest.relative_to(proj))}


@app.post("/api/projects/{project_id}/manifest")
async def save_manifest(project_id: str, payload: dict):
    proj = get_project_dir(project_id)
    with open(proj / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return {"ok": True}


# ── Phase 1: generate images only ──────────────────────────────────────────────
@app.post("/api/projects/{project_id}/generate-images")
async def generate_images(project_id: str, background_tasks: BackgroundTasks):
    proj = get_project_dir(project_id)
    if not (proj / "manifest.json").exists():
        raise HTTPException(400, "No manifest found.")
    job_id = str(uuid.uuid4())[:8]
    job_status[job_id] = {"status": "running", "project_id": project_id, "log": [], "progress": 0}
    background_tasks.add_task(run_images, project_id, proj, job_id, job_status)
    return {"job_id": job_id}


# ── Phase 1b: regenerate one page ──────────────────────────────────────────────
@app.post("/api/projects/{project_id}/regen-page")
async def regen_page(
    project_id: str,
    background_tasks: BackgroundTasks,
    page_index: int = Form(...),
    extra_instruction: str = Form(""),
):
    proj = get_project_dir(project_id)
    if not (proj / "manifest.json").exists():
        raise HTTPException(400, "No manifest found.")
    job_id = str(uuid.uuid4())[:8]
    job_status[job_id] = {"status": "running", "project_id": project_id, "log": [], "progress": 0}
    background_tasks.add_task(
        run_regen_page, project_id, proj, job_id, job_status, page_index, extra_instruction
    )
    return {"job_id": job_id}


# ── Phase 2: finalize — PDF + video ────────────────────────────────────────────
@app.post("/api/projects/{project_id}/finalize")
async def finalize(project_id: str, background_tasks: BackgroundTasks):
    proj = get_project_dir(project_id)
    if not (proj / "manifest.json").exists():
        raise HTTPException(400, "No manifest found.")
    job_id = str(uuid.uuid4())[:8]
    job_status[job_id] = {"status": "running", "project_id": project_id, "log": [], "progress": 0}
    background_tasks.add_task(run_finalize, project_id, proj, job_id, job_status)
    return {"job_id": job_id}


# ── Job polling ─────────────────────────────────────────────────────────────────
@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in job_status:
        raise HTTPException(404, "Job not found")
    return job_status[job_id]


# ── Outputs list ────────────────────────────────────────────────────────────────
@app.get("/api/projects/{project_id}/outputs")
def list_outputs(project_id: str):
    proj   = get_project_dir(project_id)
    pdf    = proj / "book_pdfs" / "story_book.pdf"
    video  = proj / "final_video.mp4"
    images = sorted((proj / "generated_images").glob("page_*.png")) if (proj / "generated_images").exists() else []
    title  = proj / "generated_images" / "title_page.png"
    return {
        "pdf":    f"/api/projects/{project_id}/files/book_pdfs/story_book.pdf" if pdf.exists() else None,
        "video":  f"/api/projects/{project_id}/files/final_video.mp4" if video.exists() else None,
        "title":  f"/api/projects/{project_id}/files/generated_images/title_page.png" if title.exists() else None,
        "images": [f"/api/projects/{project_id}/files/generated_images/{p.name}" for p in images],
    }


# ── File serving ────────────────────────────────────────────────────────────────
@app.get("/api/projects/{project_id}/files/{filename:path}")
def serve_file(project_id: str, filename: str):
    target = get_project_dir(project_id) / filename
    if not target.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(target))


# ── Serve React SPA ─────────────────────────────────────────────────────────────
STATIC_DIR = Path("/app/static")
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(str(STATIC_DIR / "index.html"))
