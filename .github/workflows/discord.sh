#!/bin/bash
set -o pipefail

# Set these manually for local testing
VERSION="v0.1.2"
RELEASE_DATE=$(date '+%Y-%m-%d')
DISCORD_WEBHOOK="https://discord.com/api/webhooks/your_webhook_url_here"

RELEASE_LINK="https://github.com/tallclub/matimo/releases/tag/$VERSION"
CONTENT="🎉 New release $VERSION — $RELEASE_DATE\n\nSee full changelog: $RELEASE_LINK"

# Print for debug
echo "Payload content:"
echo -e "$CONTENT"

PAYLOAD=$(jq -n --arg username "Matimo Release Bot" --arg content "$CONTENT" '{ username: $username, content: $content }')

# Send to Discord
curl -v -H 'Content-Type: application/json' -d "$PAYLOAD" "$DISCORD_WEBHOOK"