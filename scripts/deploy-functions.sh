FIREBASE_DEPLOY_FUNCTIONS="$(node ./scripts/functions-list-methods.js $1)" # Pass first arguement to script

firebase functions:config:set auth.firebase=${FIREBASE_FUNCTIONS_AUTH}
firebase functions:config:set slack.secret=${SLACK_CLIENT_SECRET}
firebase functions:config:set aws.id=${AWS_S3_ACCESS_KEY_ID}
firebase functions:config:set aws.key=${AWS_S3_SECRET_ACCESS_KEY}
firebase deploy --only $FIREBASE_DEPLOY_FUNCTIONS --non-interactive --token $FIREBASE_TOKEN
