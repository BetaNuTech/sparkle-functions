# Sparkle Functions

The Backend application for Sparkle.  This repo contains 2 apps:
- **Functions**: (in `/functions`) is the API, watchers, and messaging subscribers. This is probably the application you want to modify.
- **Appengine**: (in `/appengine`) manages the message broker and CRON jobs. _You likely do not need to modify this application._

### Development
To configure local development add a `.env` file to the root of this repo configured for the development firebase project.

```
PORT=3000
AWS_S3_ACCESS_KEY_ID=abc
AWS_S3_SECRET_ACCESS_KEY=123
AWS_S3_BUCKET_NAME=name

FIREBASE_FUNCTIONS_AUTH=...
FIREBASE_PROJECT=project-id
FIREBASE_DB_URL=https://...
FIREBASE_STORAGE_BUCKET=*.appspot.co

GLOBAL_API_TOKEN=123abc
GLOBAL_API_DOMAIN=https://url.net

// Optional:
COBALT_DOMAIN=https://..
```

You can start the local dev server by:
```sh
cd ./functions
yarn run dev
```
After installing dependencies (see steps below) it should start server on `localhost:3000`.  You can interact with the local server using POSTman.


### Testing
To configure testing add a `.env.test` file to the root of this repo configured for the testing firebase project.

```
AWS_S3_ACCESS_KEY_ID=abc
AWS_S3_SECRET_ACCESS_KEY=123
AWS_S3_BUCKET_NAME=name

FIREBASE_FUNCTIONS_AUTH=...
FIREBASE_PROJECT=project-id
FIREBASE_DB_URL=https://...
FIREBASE_STORAGE_BUCKET=*.appspot.co

GLOBAL_API_TOKEN=123abc
GLOBAL_API_DOMAIN=https://url.net
```

To run a single test file: `npx mocha ./test/path/to/file.test.js`

### Installation

Installing the firebase functions for local development.

```sh
# Using Docker
docker-compose run yarn-fn

# Otherwise
cd functions
nvm use # please use NVM
yarn # ensure you have yarn installed
```

### Functions Docker Commands

All docker commands you can run on the functions app.

1. Adding new dependencies

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
docker-compose run deploy-fn
```
