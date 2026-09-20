#!/usr/bin/env bash
# Uses the sibling slide serializer and a temporary npm-cache Marp CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
node ../slides-site/validate.mjs docs/debrief-2026-09-20.yaml
node ../slides-site/render-deck.mjs docs/debrief-2026-09-20.yaml --md --out docs
# The player's Markdown image export has no height bound. Keep screenshots
# inside a 720px slide; this rule belongs to this exported deck only.
python3 - <<'PY'
from pathlib import Path
p = Path('docs/neorgon-ui-debrief.md')
s = p.read_text().replace('  section { color-scheme: dark; }', '''  section { color-scheme: dark; }
  section img { max-height: 480px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }''')
p.write_text(s)
PY
npx --yes --package @marp-team/marp-cli marp docs/neorgon-ui-debrief.md --pdf --html --allow-local-files -o docs/neorgon-ui-debrief.pdf
npx --yes --package @marp-team/marp-cli marp docs/neorgon-ui-debrief.md --html --allow-local-files -o docs/neorgon-ui-debrief.html
node ../slides-site/check-exports.mjs --built docs
