Leyline Labyrinth collectible icon drop-in folder

Place collectible icons for labyrinth relics here.

Filename convention:
- Use slug ids from item ids.
- Example: relic:cipher-driftglass -> relic-cipher-driftglass.png
- Lowercase with dashes, non-alphanumeric characters replaced by "-".

Rendering behavior:
- UI resolves icons via assets/icons/labyrinth-items/{slug}.png
- Missing files fall back to text tokens automatically.
- Keep an unknown.png file to customize hidden/unknown relic cards.

Recommended asset spec:
- PNG with transparency
- 64x64 minimum, 128x128 preferred
- Keep silhouettes readable at small sizes
