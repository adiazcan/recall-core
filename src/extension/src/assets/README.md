# Extension Assets

This directory contains icons for the browser extension.

## Placeholder Icons

The current `.svg` icons are development placeholders. Before Chrome Web Store submission, replace them with properly designed PNG icons:

- `icon-16.png` - Favicon and small toolbar (16x16)
- `icon-32.png` - Toolbar 2x (32x32)
- `icon-48.png` - Extension management page (48x48)
- `icon-128.png` - Chrome Web Store and installation (128x128)

## Generating PNG Icons

Convert the SVG placeholders to PNG using ImageMagick:

```bash
for size in 16 32 48 128; do
  convert icon-${size}.svg icon-${size}.png
done
```

Or use a tool like https://realfavicongenerator.net for production icons.
