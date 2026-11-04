#!/bin/sh
# Fail the CI job when any step fails. Without this a failed functions
# deploy was masked by the firestore rules deploy that follows it.
set -e

# Runtime values reach deployed functions as environment variables loaded
# from functions/.env at deploy time. This replaces functions:config:set
# (Runtime Config), which firebase-functions v7 no longer reads. The
# FIREBASE_ prefix is reserved for .env keys, so the service account is
# passed as SPARKLE_FUNCTIONS_AUTH.
#
# GLOBAL_API_* are deliberately left out. They were only ever written to
# Runtime Config under a key config/global-api.js never read, so the Global
# API integration has never been active in deployed functions. Add them here
# only when that integration is meant to go live.
ENV_FILE=functions/.env
umask 077
: > "$ENV_FILE"
write_env() {
  case "$2" in
    *"'"*) echo "ERROR: $1 contains a single quote"; exit 1 ;;
  esac
  if [ -n "$2" ]; then printf "%s='%s'\n" "$1" "$2" >> "$ENV_FILE"; fi
}
write_env SPARKLE_FUNCTIONS_AUTH "$FIREBASE_FUNCTIONS_AUTH"
write_env SLACK_CLIENT_ID "$SLACK_CLIENT_ID"
write_env SLACK_CLIENT_SECRET "$SLACK_CLIENT_SECRET"
write_env AWS_S3_ACCESS_KEY_ID "$AWS_S3_ACCESS_KEY_ID"
write_env AWS_S3_SECRET_ACCESS_KEY "$AWS_S3_SECRET_ACCESS_KEY"
write_env AWS_S3_BUCKET_NAME "$AWS_S3_BUCKET_NAME"
write_env CLIENT_DOMAIN "$CLIENT_DOMAIN"
write_env COBALT_DOMAIN "$COBALT_DOMAIN"
trap 'rm -f "$ENV_FILE"' EXIT

echo "n\n" | firebase deploy --only functions --interactive --token $FIREBASE_TOKEN

# Firestore security rules. Scoped to firestore:rules on purpose: a broader
# deploy would also try the realtime database rules, and firebase.json points
# those at database.rules.json, which does not exist in this repo.
firebase deploy --only firestore:rules --token $FIREBASE_TOKEN
