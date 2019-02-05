FIREBASE_DEPLOY_FUNCTIONS="$(node ../scripts/functions-list-methods.js $1)" # Pass first arguement to script

firebase deploy --only ${FIREBASE_DEPLOY_FUNCTIONS} --non-interactive --token $FIREBASE_TOKEN
