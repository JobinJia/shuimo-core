#!/usr/bin/env bash
# Production deploy + auto-alias to shuimo-core.vercel.app.
#
# Vercel doesn't let you register *.vercel.app as a project-level production
# domain via CLI, so we re-alias on every prod deploy until that's possible.
#
# Usage: pnpm deploy:prod

set -euo pipefail

SCOPE="jobinjias-projects"
PROJECT="shuimo-core"
ALIAS="shuimo-core.vercel.app"

echo "→ Triggering production deploy on $PROJECT..."
DEPLOY_OUT=$(vercel deploy --prod --yes --no-wait --scope "$SCOPE")
URL=$(echo "$DEPLOY_OUT" | grep -oE "${PROJECT}-[a-z0-9]+-${SCOPE}\.vercel\.app" | head -1)

if [ -z "$URL" ]; then
  echo "✗ Could not extract deployment URL from vercel output:"
  echo "$DEPLOY_OUT"
  exit 1
fi

echo "→ Deployment URL: https://$URL"
echo "→ Waiting for build to finish..."

while true; do
  STATE=$(vercel ls "$PROJECT" --scope "$SCOPE" --format json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['deployments'][0]['state'])" 2>/dev/null \
    || echo "UNKNOWN")
  case "$STATE" in
    READY)
      break
      ;;
    ERROR|CANCELED)
      echo "✗ Build ended with state: $STATE"
      echo "  Inspect: vercel inspect --logs $URL --scope $SCOPE"
      exit 1
      ;;
    *)
      printf "."
      sleep 5
      ;;
  esac
done

echo
echo "→ Aliasing https://$ALIAS → https://$URL"
vercel alias set "$URL" "$ALIAS" --scope "$SCOPE"

echo
echo "✅ Production deploy complete:"
echo "    https://$ALIAS"
echo "    https://$URL  (immutable)"
