# gCloud CRON App [![CircleCI](https://circleci.com/gh/BetaNuTech/sparkle-functions.svg?style=svg)](https://circleci.com/gh/BetaNuTech/sparkle-functions)
Google Cloud Node.js app to issue cron jobs

# Requirements
- docker
- docker-compose

# Setup Appengine App
1. [Create gcloud app](https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com)
- Ensure that [PubSub API](https://console.cloud.google.com/apis/api/pubsub.googleapis.com/overview) is enabled for app
- Ensure [Google Cloud Storage](https://console.cloud.google.com/apis/library/storage-component.googleapis.com?q=storage&id=466e130e-03f7-4da9-965c-10f7e2cf0bd1) is enabled for app (you may have to wait a few minutes before deploying)
- Ensure that [project billing](https://support.google.com/cloud/answer/6293499#enable-billing) is enabled for app

2. [Create a service account](https://console.cloud.google.com/iam-admin/serviceaccounts)
- Ensure user's have sufficient permissions to deploy apps.
- Download a JSON key file, used for `gcloud` authorization.
- Copy the JSON file to repo root as `auth.json`

3. Build & Authorize `gcloud`
```sh
docker-compose run gcloud-auth
```

4. Initialize gCloud utility
```sh
docker-compose run gcloud init
```
Follow instructions using JSON file credentials and selecting Firebase project.

5. Set current project
```sh
docker-compose run gcloud config set project <my-project>
```
Ensure you select the Firebase app as the project

6. Create the gCloud app
```sh
docker-compose run gcloud app create
```
Follow all instructions, using the user with credentials for Firebase app
- Ensure you set permissions for users pushing to [Storage buckets](https://console.cloud.google.com/storage/browser)

7. Add `.env` file for local development with following options:

```
GOOGLE_CLOUD_PROJECT=project-id
PORT=3000

AWS_S3_ACCESS_KEY_ID=abc
AWS_S3_SECRET_ACCESS_KEY=123

FIREBASE_FUNCTIONS_AUTH=...
FIREBASE_PROJECT=sapphire
FIREBASE_DB_URL=https://...
FIREBASE_STORAGE_BUCKET=*.appspot.com

// Optional:
COBALT_DOMAIN=https://..
```

8. Add environment variables to production for HTTP endpoints:
  - inspectionPdfReport

**To add their ENV variables:**
  - In the Google Cloud Platform Console, select Cloud Functions from the left menu.
  - Select each function by clicking on its name in the functions list.
  - Click the Edit icon in the top menu.
  - Click More to display the advanced options, and enter `AWS_S3_ACCESS_KEY_ID` & `AWS_S3_SECRET_ACCESS_KEY` variables
  - Also a good idea to increase its max timeout by following instructions below
  - Click Save to update the function.

9. Install Appengine dependencies
```sh
docker-compose run yarn
```

10. Local Appengine Server
```sh
docker-compose up start
```

11. Deploy Appengine
```sh
docker-compose run deploy
```

# Firebase Functions

1. Install dependencies
```sh
docker-compose run yarn-fn add <npm-module>
```

2. Running unit tests
```sh
docker-compose run test-unit-fn
```

3. Running End to End tests
```sh
docker-compose run test-e2e-fn
```

4. Watch filesystem and run unit tests
```sh
docker-compose run yarn-fn dev
```

4. Deploying Firebase Functions
```sh
docker build -t lgvalle/firebase-tools-docker .
docker run -p 9005:9005 -u node -it lgvalle/firebase-tools-docker sh
/ $ firebase login
```
[Source repository](https://github.com/lgvalle/firebase-tools-docker)

### CRON Job (PubSub) Timeouts
**Functions that include the word "sync" need a longer timeout**.
Follow these steps to increase their runtime allowance:

1. In the Google Cloud Platform Console, select Cloud Functions from the left menu.
2. Select a function by clicking on its name in the functions list.
3. Click the Edit icon in the top menu.
4. Click More to display the advanced options, and enter `540` (the maximum amount) seconds in the Timeout text box.
5. Click Save to update the function.
