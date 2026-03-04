---
title: Storybook Generator
emoji: 📖
colorFrom: yellow
colorTo: gray
sdk: docker
pinned: false
---

# 📖 Storybook Generator

Turn photos, toy sets, drawings, or game screenshots into a children's book PDF and animated video — starring your own characters.

## ✨ Features

- 🧱 LEGO · 🦕 Dino Toys · 🧸 Plush · 🪵 Wooden · ⛏️ Minecraft · 🎮 Roblox · ✏️ Hand-drawn styles
- Upload your own characters, locations, and page references
- Review every generated image before spending tokens on video
- Regenerate any page with optional instructions
- Downloads as PDF + animated MP4 video

## 🤗 HuggingFace Spaces

This app runs as a Docker Space on HuggingFace. Enter your [xAI API key](https://console.x.ai/) and start creating — no install needed.

## 🐳 Run Locally

**Docker:**
```bash
git clone https://github.com/controljb/storybook-app.git
cd storybook-app
docker-compose up --build
# Open http://localhost:7860
```

**Podman:**
```bash
git clone https://github.com/controljb/storybook-app.git
cd storybook-app
podman build -t storybook-app .
podman run -d --name storybook -p 7860:7860 storybook-app
# Open http://localhost:7860
```

## How To Use

### 1 — Setup
- Paste your **xAI API key** (sent directly to xAI, never stored on any server)
- Enter your **book title**
- Choose an **Art Style**: LEGO, Dino Toys, Plush, Wooden, Minecraft, Roblox, Drawing, or Custom
- Choose **Lighting Mood**: Bright & Warm or Dark & Moody

### 2 — Characters
- Upload a photo, toy photo, or drawing of each character
- Give them a short slug: `robin`, `dad`, `trex`
- **Fill in the Appearance Lock field** — this is how the AI keeps clothing colors consistent:
  - ✅ `Girl, PURPLE shirt always, brown pigtails, blue jeans. NEVER change shirt color.`
  - ✅ `Adult male, GREEN hoodie always, dark hair. NO beard.`
- Toggle **✏️ Drawing?** if the reference image is hand-drawn

### 3 — Locations
- Upload close-up and/or wide photos of each place
- Add tags so the AI auto-matches: `jungle, forest, trees`

### 4 — Pages
- **Page Text** — what your child reads aloud
- **Scene Description** — guides the AI image (optional but helps a lot)
- **Reference Image** — optional photo or drawing of the scene
- Select which characters appear and optionally pin a location

### 5 — Generate → Review → Finalize
1. **🖼 Generate Page Images** — generates all images first
2. **Review** each page — regenerate any you don't like with optional instructions
3. **🎬 Finalize Book & Video** — builds your PDF and MP4 when you're happy

## Output Files

```
projects/
  {project-id}/
    generated_images/    ← individual page PNGs
    book_pdfs/           ← story_book.pdf
    generated_videos/    ← per-page MP4s
    final_video.mp4      ← assembled movie
```

## Stopping the App

```bash
# Docker
docker-compose down

# Podman
podman stop storybook && podman rm storybook
```

## Notes

- Requires an [xAI API key](https://console.x.ai/) with credits for Grok image + video + chat models
- Each page uses approximately 2–4 API calls for images; video generation is additional
- The `projects/` folder persists between restarts on local installs
- Character appearance consistency works best when you fill in the Appearance Lock description

## License

MIT
