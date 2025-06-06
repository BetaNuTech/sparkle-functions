# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

Sparkle Functions is a Firebase Cloud Functions application with two main components:
- **Functions** (`/functions`): The main API, Firebase watchers, and Pub/Sub subscribers - this is where most development happens
- **AppEngine** (`/appengine`): Message broker and CRON jobs - rarely needs modification

The Functions app follows a feature-based directory structure where each domain (inspections, deficient-items, properties, etc.) contains:
- `api/` - HTTP API endpoints
- `utils/` - Domain-specific utilities  
- `pubsub/` - Message queue subscribers
- Firestore event watchers (onUpdate, onWrite, onDelete)

Key architectural patterns:
- **Models**: Database operations using Firebase Admin SDK (`/models`)
- **Router**: Express.js API router with middleware (`router.js`)
- **Config**: Environment-specific configuration (`/config`)
- **Middleware**: Authentication and authorization (`/middleware`, `/utils`)
- **Test Helpers**: Shared testing utilities (`/test-helpers`)

## Development Commands

Working in `/functions` directory:

```bash
# Development server (auto-restart)
npm run dev

# Testing
npm test                 # Run all tests (unit + integration)
npm run test-unit       # Unit tests only
npm run test-int        # Integration tests only  
npm run test-e2e        # End-to-end tests only

# Single test file
npx mocha ./path/to/test.spec.js

# Linting
npm run lint

# Test coverage
npm run coverage
```

## Docker Development

```bash
# Install dependencies
docker-compose run yarn-fn

# Add new dependencies  
docker-compose run yarn-fn add <package>

# Run tests
docker-compose run test-unit-fn
docker-compose run test-e2e-fn

# Deploy functions
docker-compose run deploy-fn
```

## Environment Setup

Development requires `.env` file in project root:
```
PORT=3000
AWS_S3_ACCESS_KEY_ID=...
AWS_S3_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=...
FIREBASE_FUNCTIONS_AUTH=...
FIREBASE_PROJECT=...
FIREBASE_DB_URL=...
FIREBASE_STORAGE_BUCKET=...
GLOBAL_API_TOKEN=...
GLOBAL_API_DOMAIN=...
```

Testing requires `.env.test` file with test environment configuration.

## Code Organization

- **API Endpoints**: Follow `/v0/resource` pattern with middleware authentication
- **Firebase Functions**: Event-driven functions in `index.js` (watchers, Pub/Sub subscribers)
- **Models**: Database operations with validation using `model-setup.js` proxy pattern
- **Authentication**: Role-based auth (admin, corporate, team, property) via `auth-firebase-user.js`
- **Integrations**: Slack, Trello, Yardi external service integrations

## Testing Strategy

- **Unit Tests**: `.spec.js` files alongside source code
- **Integration Tests**: `/test/integration/` - test with real Firebase connections
- **End-to-End Tests**: `/test/end-to-end/` - full workflow testing
- Test setup in `/test/setup.js` with Mocha configuration in `/test/mocha.opts`

## Key Dependencies

- Firebase Admin SDK for database/auth operations
- Express.js for HTTP API with CORS and body parsing
- AWS SDK for S3 storage operations  
- External API integrations (Slack, Trello, Yardi)
- Testing: Mocha, Chai, Sinon, Supertest
- Code style: ESLint with Airbnb configuration