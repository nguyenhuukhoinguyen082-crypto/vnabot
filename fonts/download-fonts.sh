#!/bin/bash
# Download Roboto fonts from Google Fonts
# This script is used for Railway deployments where system fonts are not available

echo "Downloading Roboto fonts from Google Fonts..."

# Download Roboto Regular
curl -o Roboto-Regular.ttf "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf"
echo "✓ Downloaded Roboto-Regular.ttf"

# Download Roboto Bold
curl -o Roboto-Bold.ttf "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf"
echo "✓ Downloaded Roboto-Bold.ttf"

echo "Done! Fonts are ready for use."
