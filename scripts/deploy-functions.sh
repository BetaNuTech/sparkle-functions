FIREBASE_DEPLOY_FUNCTIONS="$(node ./scripts/functions-list-methods.js $1)" # Pass first arguement to script

firebase functions:config:set auth.firebase=${FIREBASE_FUNCTIONS_AUTH}
firebase functions:config:set slack.secret=${SLACK_CLIENT_SECRET}
firebase deploy --only ${FIREBASE_DEPLOY_FUNCTIONS} --non-interactive --token $FIREBASE_TOKEN
