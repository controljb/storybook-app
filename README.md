# 📖 Storybook Generator

Turn your game screeshots into a children's book PDF and animated video.

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An [xAI API key](https://console.x.ai/) with access to Grok image + video models

## Quick Start

```bash
# 1. Clone / place this folder anywhere on your machine
cd storybook-app

# 2. Build and start
#podman:
podman build -t storybook-app .
podman run -d --name storybook -p 8000:8000 storybook-app

#or docker
docker-compose up --build

# 3. Open your browser
http://localhost:8000
```

That's it. The app runs entirely on your machine.

## How To Use

### Setup
- Paste your **xAI API key** (stays in your browser, sent only to xAI)
- Enter your **book title**
- Optionally upload a **title page screenshot**
- Choose **Parchment** (warm tan) or **Dark** (purple-tinted) text overlay style

### Characters
- Upload a screenshot of each character
- Give them a short slug: `dad`, `grayson`, `boots`
- Write a description so the AI locks their appearance (e.g. *"Adult male in green shirt. NO beard."*)
- Hit **+** to add more characters

### Locations
- Upload a close-up and/or wide screenshot of each place
- Give it a slug: `city`, `forest`, `cave`
- Add **tags** so the AI auto-detects when a page belongs there: `city, town, home, base`
- Hit **+** to add more locations

### Pages
- **Page Text** — what your child actually reads (required for every page)
- **Scene Description** — guides image generation (optional but helps a lot)
- **Reference Screenshot** — an optional scene screenshot (doesn't have to match every page)
- **Characters** — click which characters appear on this page
- **Location** — select a location or leave as auto-detect (uses tags to match)
- Hit **+** to add more pages

### Generate
- Hit **✨ Generate My Book**
- Watch the live log — takes 5–15 minutes depending on page count
- Download your **PDF** and/or **Video** when done

## Output Files

All generated files are saved in the `projects/` folder next to `docker-compose.yml`:

```
projects/
  {project-id}/
    generated_images/   ← individual page PNGs
    book_pdfs/          ← story_book.pdf
    generated_videos/   ← per-page videos
    final_video.mp4     ← assembled movie
```

## Stopping the App

```bash
podman stop storybook && podman rm storybook
or in docker
docker-compose down
```

## Notes

- You need xAI credits for image generation, video generation, and the Grok-4 text model (used to rewrite narration in child-friendly language)
- Each page uses approximately 2–4 API calls (env plate + page image + video)
- The `projects/` folder persists between restarts — your past books are always there
