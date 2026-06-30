# Fonts Directory

This folder contains custom fonts for the canvas flight board rendering.

## Why Custom Fonts?

Railway's Linux containers don't have system fonts installed by default. When `@napi-rs/canvas` can't find a font, it renders text as empty boxes (□□□□). By registering fonts manually, we ensure consistent text rendering across all deployments.

## Setup

The required Roboto fonts need to be downloaded before deployment:

### Option 1: Using Node.js (Recommended for Railway)
```bash
node fonts/download-fonts.js
```

### Option 2: Using Bash
```bash
bash fonts/download-fonts.sh
```

### Option 3: Manual Download
Download from Google Fonts and place in this folder:
- [Roboto-Regular.ttf](https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxP.ttf)
- [Roboto-Bold.ttf](https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlf.ttf)

## Railway Deployment

Add this to your `Procfile` or build script to ensure fonts are downloaded before the app starts:

```
release: node fonts/download-fonts.js
web: node index.js
```

Or add to your `package.json` postinstall script:

```json
{
  "scripts": {
    "postinstall": "node fonts/download-fonts.js"
  }
}
```

## Files

- `download-fonts.js` - Node.js script to download fonts (cross-platform)
- `download-fonts.sh` - Bash script to download fonts
- `Roboto-Regular.ttf` - Regular weight font (auto-generated)
- `Roboto-Bold.ttf` - Bold weight font (auto-generated)
