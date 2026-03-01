# Neorgon

A hub page consolidating all Neorgon tools and platforms in one place.

**Live:** [neorgon.com](https://neorgon.com/) · static HTML, no build step, no backend.

---

## What it does

A minimal, neon-space landing page that links to every Neorgon site with a short description and quick-launch card.

---

## Sites linked

| Site | Domain | Description |
|------|--------|-------------|
| Energon HQ | [ehq.cl](https://ehq.cl/) | Main platform and command center |
| Local Drills | [localdrills.neorgon.com](https://localdrills.neorgon.com/) | AWS / Kubernetes / GitLab CI/CD challenges |
| Skill Roadmap | [diagrams.neorgon.com](https://diagrams.neorgon.com/) | Visual skill and learning path builder |
| Client Says | [clientsays.neorgon.com](https://clientsays.neorgon.com/) | Timezone converter + jargon translator |
| Spin the Wheel | [wheel.neorgon.com](https://wheel.neorgon.com/) | Customizable decision wheel |
| JSON Builder | [jsonbuilder.neorgon.com](https://jsonbuilder.neorgon.com/) | Visual JSON schema builder + JIRA adjuster |
| Reference Matrix | [references.neorgon.com](https://references.neorgon.com/) | Enerbot meme references — live regex playground + JSON API |

---

## Design

- Deep space background (`#000912`)
- Animated starfield (canvas, 200 twinkling stars)
- Ambient neon glow orbs
- Subtle perspective grid
- Glassmorphism cards with per-card neon border glow on hover
- `color-mix()` for tag badge tinting from card accent color
- `prefers-reduced-motion` respected (stars rendered statically)

---

## Running locally

```bash
cd neorgon-site
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `index.html` directly — no dependencies, no install.

---

## Tech

Pure HTML + CSS + JavaScript. Starfield uses `requestAnimationFrame` on a `<canvas>`. Card glow effects use CSS custom properties (`--card-glow`, `--card-accent`) set per-card via inline `style`.
