#!/bin/sh

CONFIG_FILE="/var/www/public/config.js"
INDEX_FILE="/var/www/public/index.html"

# Generate config.js with current environment variables
echo "window.ENV = {" > "$CONFIG_FILE"
echo "  VITE_BACKEND_URL: \"${VITE_BACKEND_URL:-/}\"," >> "$CONFIG_FILE"
echo "  VITE_PLUGIN_MANAGER_URL: \"${VITE_PLUGIN_MANAGER_URL:-/plugins/}\"," >> "$CONFIG_FILE"
echo "  VITE_HOURS_CLOSE_TICKETS_AUTO: \"${VITE_HOURS_CLOSE_TICKETS_AUTO:-24}\"" >> "$CONFIG_FILE"
echo "};" >> "$CONFIG_FILE"

# Inject script tag with cache buster into index.html
if grep -q 'env-insertion-point' "$INDEX_FILE"; then
  TIMESTAMP=$(date +%s)
  sed -i "s|<noscript id=\"env-insertion-point\"></noscript>|<script src=\"/config.js?v=$TIMESTAMP\"></script>|g" "$INDEX_FILE"
fi

echo "Runtime environment injected into $CONFIG_FILE and index.html updated"

# Inject Backend URL into Nginx Config
if [ ! -z "$URL_BACKEND" ]; then
    echo "Injecting URL_BACKEND ($URL_BACKEND) into Nginx config..."
    sed -i "s|__URL_BACKEND__|$URL_BACKEND|g" /etc/nginx/conf.d/default.conf
else
    echo "WARNING: URL_BACKEND not set, using default..."
fi
