firebase functions:config:set auth.firebase=${FIREBASE_FUNCTIONS_AUTH}
firebase functions:config:set slack.clientid=${SLACK_CLIENT_ID}
firebase functions:config:set slack.secret=${SLACK_CLIENT_SECRET}
firebase functions:config:set aws.id=${AWS_S3_ACCESS_KEY_ID}
firebase functions:config:set aws.key=${AWS_S3_SECRET_ACCESS_KEY}
firebase functions:config:set aws.bucketname=${AWS_S3_BUCKET_NAME}
firebase functions:config:set web.clientdomain=${CLIENT_DOMAIN}
firebase functions:config:set globalapi.token=${GLOBAL_API_TOKEN}
firebase functions:config:set globalapi.domain=${GLOBAL_API_DOMAIN}
if [ ! -z "$COBALT_DOMAIN" ]; then firebase functions:config:set cobalt.domain=${COBALT_DOMAIN}; fi
echo "n\n" | firebase deploy --only functions --interactive --token $FIREBASE_TOKEN

# Firestore security rules. Scoped to firestore:rules on purpose: a broader
# deploy would also try the realtime database rules, and firebase.json points
# those at database.rules.json, which does not exist in this repo.
firebase deploy --only firestore:rules --token $FIREBASE_TOKEN
