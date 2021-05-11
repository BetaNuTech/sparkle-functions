firebase functions:config:set auth.firebase=${FIREBASE_FUNCTIONS_AUTH}
firebase functions:config:set slack.secret=${SLACK_CLIENT_SECRET}
firebase functions:config:set aws.id=${AWS_S3_ACCESS_KEY_ID}
firebase functions:config:set aws.key=${AWS_S3_SECRET_ACCESS_KEY}
firebase functions:config:set aws.bucketname=${AWS_S3_BUCKET_NAME}
firebase functions:config:set web.clientdomain=${CLIENT_DOMAIN}
firebase functions:config:set globalapi.token=${GLOBAL_API_TOKEN}
firebase functions:config:set globalapi.domain=${GLOBAL_API_DOMAIN}
if [ ! -z "$COBALT_DOMAIN" ]; then firebase functions:config:set cobalt.domain=${COBALT_DOMAIN}; fi
echo "n\n" | firebase deploy --only functions --interactive --token $FIREBASE_TOKEN
