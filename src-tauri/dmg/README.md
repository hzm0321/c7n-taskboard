# C7N Codex DMG artwork

The installation canvas reproduces the supplied reference: pale blue waves, directional arrow, “高效 · 智能 · 低代码”, handwritten drag instruction, and the lower-right fish. The app and Applications icons are real Finder items, not part of the background. macOS draws the title bar and Applications icon in its own system style.

- Canvas: 752 × 436 points; TIFF contains 1× and 2× representations.
- Icons: 160 points, centered at (212, 155) and (537, 155).
- Labels: Finder text, 18 points.
- `build-dmg.py` uses `dmgbuild` to dynamically generate `.DS_Store` with modern macOS Bookmark (`pBBk`) and Alias (`icvp`) records matching the exact volume metadata without needing interactive Finder/AppleScript automation.

To regenerate the TIFF after editing PNGs:

```sh
tiffutil -cathidpicheck src-tauri/dmg/background.png src-tauri/dmg/background@2x.png -out src-tauri/dmg/background.tiff
```

`npm run app:build` uses these assets through `scripts/package-macos-app.mjs`.
