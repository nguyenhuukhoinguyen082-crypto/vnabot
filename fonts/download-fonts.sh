#!/bin/bash
# Download Roboto fonts from Google Fonts
# This script is used for Railway deployments where system fonts are not available

echo "Downloading Roboto fonts from Google Fonts..."

# Download Roboto Regular
curl -o Roboto-Regular.ttf "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxP.ttf"
echo "✓ Downloaded Roboto-Regular.ttf"

# Download Roboto Bold
curl -o Roboto-Bold.ttf "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlf.ttf"
echo "✓ Downloaded Roboto-Bold.ttf"

echo "Done! Fonts are ready for use."
