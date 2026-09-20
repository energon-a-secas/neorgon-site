---
marp: true
theme: default
paginate: true
backgroundColor: "#080f20"
color: "#f9f9f9"
title: "Neorgon priority refinements"
author: "Neorgon"
style: |
  section { color-scheme: dark; }
  section img { max-height: 480px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
---

# The visual pass left three usability gaps

**Three priorities, implemented in order**

Neorgon

---

## News is one tap away on phones
![Mobile Antenne panel opened explicitly from the dock](priority-refinements-img/mobile-news.png)

---

## Previews work with keys, touch, and reduced motion
![Quiz preview rendered as a still with an explicit close control](priority-refinements-img/still-preview.png)

---

## Each linked tool has a name and an icon
![News stories with deduplicated catalog tool names and icons](priority-refinements-img/antenne-tools.png)

---

## Both browsers pass the behavior checks
- 56 bulletin assertions in Chromium and WebKit
- 28 preview assertions in each browser
- Repository icon, count and preview checks pass
- Mobile and desktop captures visually inspected

---

## The remaining costs are explicit
- Still previews currently download the source GIF
- Unrecognized story kinds need renderer support
- Existing preview gaps remain
- Manual screen-reader review is still open

---

# Verify the release on the live site

**→ Open neorgon.com**

Try mobile news, a keyboard preview, and multi-tool headlines.
