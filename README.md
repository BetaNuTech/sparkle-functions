# gcloud-cron-app
Google Cloud Node.js app to issue cron jobs

# Requirements
- docker
- docker-compose

# Setup
1. (Create gcloud app)[https://console.cloud.google.com/flows/enableapi?apiid=pubsub&redirect=https://console.cloud.google.com]
> Ensure that (project billing)[https://support.google.com/cloud/answer/6293499#enable-billing] is enabled for app

2. (Create a service account)[https://console.cloud.google.com/iam-admin/serviceaccounts]
- Ensure user's have sufficient permissions to deploy apps.
- Download a JSON key file, used for `gcloud` authorization.
- Copy the JSON file to repo root as `auth.json`

3. Build & Authorize `gcloud`
```sh
docker-compose run gcloud-auth
```

4. Login to gcloud:
```sh
docker-compose run gcloud auth login
```
Then follow instructions to authenticate

5. Initialize gCloud utility
```sh
docker-compose run gcloud init
```
Follow instructions using JSON file credentials and selecting Firebase project.

6. Set current project
```sh
docker-compose run gcloud config set project <my-project>
```
Ensure you select the Firebase app as the project

7. Create the gCloud app
```sh
docker-compose run gcloud app create
```
Follow all instructions, using the user with credentials for Firebase app

8. Enable (Google Cloud Storage)[https://console.cloud.google.com/apis/library/storage-component.googleapis.com?q=storage&id=466e130e-03f7-4da9-965c-10f7e2cf0bd1&project=fresh-prince] for app.  You may have to wait a few minutes before you deploy.

9. Add .env file for local development
*Sample .env*
```
GOOGLE_CLOUD_PROJECT=project-id
PORT=3000
```

10. Install Node.js dependencies
```sh
docker-compose run yarn
```

# Development
Running the Node.js app
```sh
docker-compose run start
```

# Deployment
```sh
docker-compose run deploy
```
