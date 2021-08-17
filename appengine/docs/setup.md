## Summary

How to setup and deploy the Google Appengine application. Commands should be run from the root of the project

## Requirements

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

7. Ensure you follow the direction to add `.env` file for local development.

8. Install Appengine dependencies

```sh
docker-compose run yarn
```

9. Local Appengine Server

```sh
docker-compose up start
```

10. Deploy Appengine

```sh
docker-compose run deploy
```
