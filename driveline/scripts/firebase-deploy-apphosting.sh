#!/usr/bin/env bash
# Create App Hosting backend and deploy (requires Blaze plan).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${FIREBASE_PROJECT:-divinebytes-driveline}"
BACKEND="${APP_HOSTING_BACKEND:-driveline}"
REGION="${APP_HOSTING_REGION:-europe-west2}"
APP_ID="${FIREBASE_WEB_APP_ID:-1:249329330903:web:71828493a7ff2ea2609e92}"

FB="npx -y firebase-tools@latest"

echo "Using Firebase project: $PROJECT"
"$FB" use "$PROJECT"

if ! "$FB" apphosting:backends:list 2>/dev/null | grep -q "$BACKEND"; then
  echo "Creating App Hosting backend '$BACKEND' in $REGION..."
  "$FB" apphosting:backends:create \
    --backend "$BACKEND" \
    --primary-region "$REGION" \
    --root-dir . \
    --app "$APP_ID"
fi

if [ -n "${DVLA_API_KEY:-}" ]; then
  echo "Setting DVLA_API_KEY secret..."
  printf '%s' "$DVLA_API_KEY" | "$FB" apphosting:secrets:set DVLA_API_KEY --force
  "$FB" apphosting:secrets:grantaccess DVLA_API_KEY --backend "$BACKEND" || true
fi

echo "Deploying App Hosting..."
"$FB" deploy --only apphosting:"$BACKEND"

echo "Done. Add custom domain drivelinecarsales.co.uk in Firebase console → App Hosting → $BACKEND → Domains."
