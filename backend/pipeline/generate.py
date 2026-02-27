"""
pipeline/generate.py
Three entry points:
  run_images(...)      — generate all page images only
  run_regen_page(...)  — regenerate a single page image
  run_finalize(...)    — build PDF + videos from approved images
"""
import base64
import io
import json
import time
import traceback
from pathlib import Path
from typing import Optional, List, Dict

import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter

try:
    from xai_sdk import Client
    from xai_sdk.chat import user, system
    XAI_AVAILABLE = True
except ImportError:
    XAI_AVAILABLE = False

MAX_INPUT_IMAGES  = 3
REF_MAX_SIDE_CHAR = 512
REF_MAX_SIDE_LOC  = 1024
JPEG_QUALITY_LOC  = 70
GROK_RETRIES      = 2
GROK_RETRY_SLEEP  = 2


# ─────────────────────────────────────────────────────────────────
# SHARED HELPERS
# ─────────────────────────────────────────────────────────────────

def _build_helpers(client, proj: Path, manifest: dict, log):
    assets     = manifest.get("assets", {})
    char_descs = manifest.get("character_descriptions", {})
    theme      = manifest.get("theme", "light")

    global_style = manifest.get("global_style_prompt",
                                "Warm, nostalgic Minecraft pixelated blocky style.")
    if theme == "dark":
        global_style += (
            " Dark, moody cinematic lighting. Deep shadows, cool blue and purple tones,"
            " moonlit atmosphere, dramatic contrast. Night or twilight setting."
        )
    else:
        global_style += (
            " Bright, warm, cheerful lighting. Soft golden sunlight, vivid warm colors,"
            " inviting daytime atmosphere. Friendly and uplifting mood."
        )

    panel_fill    = (214, 186, 140, 205)
    panel_outline = (120, 90, 50, 200)
    text_color    = (45, 30, 15, 255)

    def encode_uri(path: Path, max_side: int, quality: int = 75) -> Optional[str]:
        if not path.exists():
            log(f"  Warning: not found -> {path}")
            return None
        img = Image.open(path)
        has_alpha = "A" in img.getbands()
        img = img.convert("RGBA" if has_alpha else "RGB")
        w, h = img.size
        scale = min(1.0, max_side / float(max(w, h)))
        if scale < 1.0:
            img = img.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.LANCZOS)
        buf = io.BytesIO()
        if has_alpha:
            img.save(buf, "PNG", optimize=True)
            mime = "image/png"
        else:
            img.save(buf, "JPEG", quality=quality, optimize=True)
            mime = "image/jpeg"
        return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"

    def grok_image(prompt: str, image_urls: List[str]):
        last = None
        for attempt in range(GROK_RETRIES + 1):
            try:
                return client.image.sample(
                    prompt=prompt, model="grok-imagine-image",
                    image_urls=image_urls if image_urls else None,
                )
            except Exception as e:
                last = e
                if attempt < GROK_RETRIES:
                    time.sleep(GROK_RETRY_SLEEP)
        raise last

    def rewrite(text: str) -> str:
        if not text:
            return text
        chat = client.chat.create(model="grok-4")
        chat.append(system("You are a cheerful editor making stories perfect for 4-6 year olds."))
        chat.append(user(
            f"Rewrite this as narration for a kindergarten children's book page. "
            f"Use very simple words, short sentences, make it fun and exciting. "
            f"Fix grammar, spelling, punctuation. Make it exactly 2 to 3 full sentences. "
            f"Original: '{text}'"
        ))
        return chat.sample().content.strip()

    def no_text_block() -> str:
        return (
            "TEXT BAN: Do NOT include any readable text anywhere in the illustration. "
            "No letters, words, numbers, signs, banners, UI overlays, subtitles, watermarks, "
            "labels, runes, or map text. The image must contain ZERO readable characters."
        )

    def consistency_rules(requested: List[str]) -> str:
        rules = [
            "ABSOLUTE CONSISTENCY RULES: Do NOT change clothing colors. "
            "Do NOT add hats, armor, backpacks, or accessories not in the reference images. "
            "Do NOT change faces, ages, or body shapes. No duplicate characters or animals."
        ]
        for cid in requested:
            d = char_descs.get(cid)
            if d:
                rules.append(d)
        if "boots" in requested:
            rules.append(
                "BOOTS LOCK: Include EXACTLY ONE cat (Boots). "
                "Match the Boots reference EXACTLY. Do NOT change fur color. Do NOT add a second cat."
            )
        else:
            rules.append("IMPORTANT: Do NOT include any cats or pets on this page.")
        return " ".join(rules)

    def pick_location(text: str) -> Optional[str]:
        t = text.lower()
        best_id, best_score = None, 0
        for loc_id, loc_data in assets.get("locations", {}).items():
            score = sum(1 for tag in loc_data.get("tags", []) if tag.lower() in t)
            if score > best_score:
                best_score, best_id = score, loc_id
        return best_id if best_score > 0 else None

    def download(url: str, dest: Path):
        data = requests.get(url, timeout=180).content
        with open(dest, "wb") as f:
            f.write(data)

    def wrap_text(draw, text, font, max_w):
        words = text.split()
        lines, cur = [], []
        for w in words:
            cur.append(w)
            if draw.textbbox((0, 0), " ".join(cur), font=font)[2] > max_w:
                cur.pop()
                if cur:
                    lines.append(" ".join(cur))
                cur = [w]
        if cur:
            lines.append(" ".join(cur))
        return "\n".join(lines)

    def render_overlay(img_path: Path, text: str, position: str = "bottom"):
        base = Image.open(img_path).convert("RGBA")
        w, h = base.size
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 44)
        except Exception:
            font = ImageFont.load_default()
        margin  = int(w * 0.05)
        panel_h = int(h * 0.22)
        if position == "top":
            panel_top    = margin
            panel_bottom = margin + panel_h
        else:
            panel_bottom = h - int(h * 0.015)
            panel_top    = panel_bottom - panel_h
        pl, pr = margin, w - margin
        shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [(pl+6, panel_top+8), (pr+6, panel_bottom+8)], radius=28, fill=(0, 0, 0, 80))
        shadow = shadow.filter(ImageFilter.GaussianBlur(6))
        overlay = Image.alpha_composite(shadow, overlay)
        draw = ImageDraw.Draw(overlay)
        draw.rounded_rectangle(
            [(pl, panel_top), (pr, panel_bottom)],
            radius=28, fill=panel_fill, outline=panel_outline, width=4)
        wrapped = wrap_text(draw, text, font, (pr - pl) - 40)
        draw.multiline_text((pl+20, panel_top+20), wrapped, font=font, fill=text_color)
        Image.alpha_composite(base, overlay).convert("RGB").save(img_path)

    # Pre-encode character refs
    char_refs: Dict[str, Optional[str]] = {}
    for cid, cdata in assets.get("characters", {}).items():
        char_refs[cid] = encode_uri(proj / cdata["path"], REF_MAX_SIDE_CHAR)

    def build_page_image(page: dict, img_path: Path, page_index: int):
        """Generate image for one page and save with text overlay."""
        desc      = rewrite(page.get("raw_description", "")) or page.get("raw_description", "")
        narration = rewrite(page.get("raw_narration_text", "")) or page.get("raw_narration_text", "")
        requested = [c for c in char_refs
                     if c in page.get("include_characters", list(char_refs.keys()))]

        combined = f"{desc} {narration} {page.get('motion_prompt', '')}"
        loc      = page.get("location") or pick_location(combined)

        base_image = page.get("base_image")
        if not base_image and loc:
            loc_data   = assets.get("locations", {}).get(loc, {})
            base_image = loc_data.get("plate") or (loc_data.get("refs", [None])[0])

        if not base_image:
            env_path  = proj / "generated_images" / f"_env_{page_index}.png"
            env_refs: List[str] = []
            if loc:
                for rp in assets.get("locations", {}).get(loc, {}).get("refs", []):
                    u = encode_uri(proj / rp, REF_MAX_SIDE_LOC, JPEG_QUALITY_LOC)
                    if u:
                        env_refs.append(u)
                        break
            env_prompt = (
                f"{no_text_block()} "
                "Create ONLY the environment/background for a Minecraft children's book page. "
                f"Do NOT include any characters or animals. Scene: {desc}. {global_style}"
            )
            resp = grok_image(env_prompt, env_refs[:1] if env_refs else [])
            download(resp.url, env_path)
            base_image = str(env_path.relative_to(proj))

        refs: List[str] = []
        base_uri = encode_uri(proj / base_image, REF_MAX_SIDE_LOC, 85)
        if base_uri:
            refs.append(base_uri)
        if "boots" in requested:
            for cid in ["boots"] + [c for c in requested if c != "boots"]:
                if len(refs) < MAX_INPUT_IMAGES and char_refs.get(cid):
                    refs.append(char_refs[cid])
        else:
            for cid in requested:
                if len(refs) < MAX_INPUT_IMAGES and char_refs.get(cid):
                    refs.append(char_refs[cid])

        scale_hint  = page.get("scale_hint", "")
        plate_instr = (
            "Use the FIRST input image as the scene plate. Preserve its camera angle and environment. "
            "Insert characters naturally: feet on ground, correct perspective, shadows. "
            "Characters must be normal human-sized relative to buildings. "
        )
        if scale_hint:
            plate_instr += scale_hint

        prompt = (
            f"{consistency_rules(requested)} "
            f"{no_text_block()} "
            f"{plate_instr} "
            f"Minecraft-style children's book illustration: {desc}. "
            f"{global_style} Do NOT include any text in the illustration."
        )
        resp = grok_image(prompt, refs[:MAX_INPUT_IMAGES])
        download(resp.url, img_path)
        render_overlay(img_path, narration)
        return narration

    return dict(
        encode_uri=encode_uri,
        grok_image=grok_image,
        rewrite=rewrite,
        download=download,
        render_overlay=render_overlay,
        char_refs=char_refs,
        global_style=global_style,
        build_page_image=build_page_image,
        consistency_rules=consistency_rules,
        no_text_block=no_text_block,
        assets=assets,
    )


# ─────────────────────────────────────────────────────────────────
# PHASE 1 — Generate all images
# ─────────────────────────────────────────────────────────────────

def run_images(project_id: str, proj: Path, job_id: str, job_status: dict):
    def log(msg: str, progress: int = None):
        print(f"[{job_id}] {msg}", flush=True)
        job_status[job_id]["log"].append(msg)
        if progress is not None:
            job_status[job_id]["progress"] = progress

    try:
        if not XAI_AVAILABLE:
            raise RuntimeError("xai_sdk not installed.")

        with open(proj / "manifest.json", encoding="utf-8") as f:
            manifest = json.load(f)

        api_key = manifest.get("api_key", "").strip()
        if not api_key:
            raise ValueError("No xAI API key in manifest.")

        client = Client(api_key=api_key)
        h      = _build_helpers(client, proj, manifest, log)
        pages  = manifest.get("pages", [])
        title_cfg = manifest.get("title")

        (proj / "generated_images").mkdir(exist_ok=True)

        log("Starting image generation...", 5)

        # Title page
        title_img_path = proj / "generated_images" / "title_page.png"
        if title_cfg:
            log("Generating title page...", 10)
            title_desc = h["rewrite"](title_cfg.get("raw_description", "")) or title_cfg.get("raw_description", "")
            title_text = title_cfg.get("title_text", "My Adventure")
            title_base = title_cfg.get("base_image")

            refs: List[str] = []
            if title_base:
                uri = h["encode_uri"](proj / title_base, REF_MAX_SIDE_LOC, 80)
                if uri:
                    refs.append(uri)
            for cid in list(h["char_refs"].keys()):
                if len(refs) < MAX_INPUT_IMAGES and h["char_refs"].get(cid):
                    refs.append(h["char_refs"][cid])

            all_chars = list(h["char_refs"].keys())
            prompt = (
                f"{h['consistency_rules'](all_chars)} "
                f"{h['no_text_block']()} "
                "If a base image is provided, preserve its composition as the scene plate. "
                "Insert characters naturally with correct perspective and shadows. "
                f"Create a warm Minecraft-style children's book cover: {title_desc}. "
                f"{h['global_style']} Do NOT include any text in the illustration."
            )
            resp = h["grok_image"](prompt, refs[:MAX_INPUT_IMAGES])
            h["download"](resp.url, title_img_path)
            h["render_overlay"](title_img_path, title_text, position="top")
            log("Title page done.", 15)

        # Content pages
        total = len(pages)
        for i, page in enumerate(pages):
            pct = 15 + int(((i + 1) / total) * 80)
            log(f"Generating page {i+1}/{total}...", pct)
            img_path = proj / "generated_images" / f"page_{i+1}.png"
            h["build_page_image"](page, img_path, i + 1)
            log(f"Page {i+1} done.", pct)

        job_status[job_id]["status"] = "review"
        job_status[job_id]["progress"] = 100
        log("All images ready. Review each page, then click Finalize.")

    except Exception as e:
        job_status[job_id]["status"] = "error"
        job_status[job_id]["error"] = str(e)
        job_status[job_id]["log"].append(f"FATAL: {e}")
        job_status[job_id]["log"].append(traceback.format_exc())


# ─────────────────────────────────────────────────────────────────
# PHASE 1b — Regenerate a single page
# ─────────────────────────────────────────────────────────────────

def run_regen_page(project_id: str, proj: Path, job_id: str,
                   job_status: dict, page_index: int, extra_instruction: str = ""):
    def log(msg: str, progress: int = None):
        print(f"[{job_id}] {msg}", flush=True)
        job_status[job_id]["log"].append(msg)
        if progress is not None:
            job_status[job_id]["progress"] = progress

    try:
        if not XAI_AVAILABLE:
            raise RuntimeError("xai_sdk not installed.")

        with open(proj / "manifest.json", encoding="utf-8") as f:
            manifest = json.load(f)

        api_key = manifest.get("api_key", "").strip()
        client  = Client(api_key=api_key)
        h       = _build_helpers(client, proj, manifest, log)
        pages   = manifest.get("pages", [])

        if page_index == 0:
            # Regenerate title page
            title_cfg  = manifest.get("title", {})
            title_desc = h["rewrite"](title_cfg.get("raw_description", "")) or title_cfg.get("raw_description", "")
            if extra_instruction:
                title_desc += f" Additional instruction: {extra_instruction}"
            title_text = title_cfg.get("title_text", "My Adventure")
            title_base = title_cfg.get("base_image")

            refs: List[str] = []
            if title_base:
                uri = h["encode_uri"](proj / title_base, REF_MAX_SIDE_LOC, 80)
                if uri:
                    refs.append(uri)
            for cid in list(h["char_refs"].keys()):
                if len(refs) < MAX_INPUT_IMAGES and h["char_refs"].get(cid):
                    refs.append(h["char_refs"][cid])

            all_chars = list(h["char_refs"].keys())
            prompt = (
                f"{h['consistency_rules'](all_chars)} "
                f"{h['no_text_block']()} "
                "Insert characters naturally with correct perspective and shadows. "
                f"Create a warm Minecraft-style children's book cover: {title_desc}. "
                f"{h['global_style']} Do NOT include any text."
            )
            img_path = proj / "generated_images" / "title_page.png"
            log("Regenerating title page...", 10)
            resp = h["grok_image"](prompt, refs[:MAX_INPUT_IMAGES])
            h["download"](resp.url, img_path)
            h["render_overlay"](img_path, title_text, position="top")

        else:
            pi   = page_index - 1
            page = dict(pages[pi])
            if extra_instruction:
                page["raw_description"] = (
                    page.get("raw_description", "") +
                    f" Additional instruction: {extra_instruction}"
                )
            img_path = proj / "generated_images" / f"page_{page_index}.png"
            log(f"Regenerating page {page_index}...", 10)
            h["build_page_image"](page, img_path, page_index)

        job_status[job_id]["status"] = "done"
        job_status[job_id]["progress"] = 100
        log(f"Page {page_index} regenerated.")

    except Exception as e:
        job_status[job_id]["status"] = "error"
        job_status[job_id]["error"] = str(e)
        job_status[job_id]["log"].append(f"FATAL: {e}")
        job_status[job_id]["log"].append(traceback.format_exc())


# ─────────────────────────────────────────────────────────────────
# PHASE 2 — Finalize: PDF + videos
# ─────────────────────────────────────────────────────────────────

def run_finalize(project_id: str, proj: Path, job_id: str, job_status: dict):
    def log(msg: str, progress: int = None):
        print(f"[{job_id}] {msg}", flush=True)
        job_status[job_id]["log"].append(msg)
        if progress is not None:
            job_status[job_id]["progress"] = progress

    try:
        if not XAI_AVAILABLE:
            raise RuntimeError("xai_sdk not installed.")

        with open(proj / "manifest.json", encoding="utf-8") as f:
            manifest = json.load(f)

        api_key = manifest.get("api_key", "").strip()
        client  = Client(api_key=api_key)
        h       = _build_helpers(client, proj, manifest, log)
        pages   = manifest.get("pages", [])

        (proj / "book_pdfs").mkdir(exist_ok=True)
        (proj / "generated_videos").mkdir(exist_ok=True)

        # Collect approved images in order
        image_paths: List[Path] = []
        title_path = proj / "generated_images" / "title_page.png"
        if title_path.exists():
            image_paths.append(title_path)
        for i in range(len(pages)):
            p = proj / "generated_images" / f"page_{i+1}.png"
            if p.exists():
                image_paths.append(p)

        # Build PDF
        log("Building PDF...", 10)
        imgs = [Image.open(p) for p in image_paths]
        if imgs:
            pdf_path = proj / "book_pdfs" / "story_book.pdf"
            imgs[0].save(str(pdf_path), "PDF", resolution=150.0,
                         save_all=True, append_images=imgs[1:])
            log("PDF created.", 30)

        # Generate videos (content pages only, skip title)
        log("Generating videos...", 35)
        video_paths: List[Path] = []
        total = len(pages)

        for i, page in enumerate(pages):
            pct = 35 + int(((i + 1) / total) * 55)
            img_path = proj / "generated_images" / f"page_{i+1}.png"
            if not img_path.exists():
                log(f"Skipping video {i+1} — image missing")
                continue

            duration  = page.get("duration_seconds", 10)
            narration = h["rewrite"](page.get("raw_narration_text", "")) or page.get("raw_narration_text", "")
            motion    = page.get("motion_prompt", "Gentle scene movement and character expressions")
            image_uri = h["encode_uri"](img_path, 1280, 80)
            if not image_uri:
                continue

            log(f"Generating video {i+1}/{total}...", pct)
            vprompt = (
                f"{motion}. {h['global_style']} "
                "ABSOLUTE RULE: Off-screen narrator voiceover only. "
                "Characters do NOT speak. NO mouth movement. No lip sync. No speech bubbles. "
                f"Read as voiceover: '{narration}'. Keep on-screen text panel readable."
            )
            try:
                resp = client.video.generate(
                    prompt=vprompt, image_url=image_uri,
                    duration=duration, aspect_ratio="16:9",
                    resolution="720p", model="grok-imagine-video",
                )
                vid_path = proj / "generated_videos" / f"page_{i+1}.mp4"
                h["download"](resp.url, vid_path)
                video_paths.append(vid_path)
                log(f"Video {i+1} done.", pct)
            except Exception as e:
                log(f"Video {i+1} failed: {e}")

        # Assemble final video
        if video_paths:
            log("Assembling final video...", 92)
            try:
                from moviepy.editor import VideoFileClip, concatenate_videoclips
                clips = [VideoFileClip(str(p)) for p in video_paths]
                final = concatenate_videoclips(clips, method="compose")
                final.write_videofile(str(proj / "final_video.mp4"), fps=24, logger=None)
                log("Final video ready.", 99)
            except Exception as e:
                log(f"Video assembly failed: {e}")

        job_status[job_id]["status"] = "done"
        job_status[job_id]["progress"] = 100
        log("All done! ✨")

    except Exception as e:
        job_status[job_id]["status"] = "error"
        job_status[job_id]["error"] = str(e)
        job_status[job_id]["log"].append(f"FATAL: {e}")
        job_status[job_id]["log"].append(traceback.format_exc())
