# Conventions

- [File Structure](#file-structure)
- [Code Styling](#code-styling)
- [Commenting](#commenting)

## File Structure

```txt
/functions
    /config // configuration settings
    /deficient-items // Deficiencies feature
    /inspections // Inspections feature
        /on-get-pdf-report // Inspection reports feature
    /jobs // Jobs & Bids feature
    /middleware // General purpose Express.js middleware
    /models // Manages database operations
        /_internal
            /archive // Manages archive database
    /notification // Notifications (Slack & Push) feature
    /properties
        /api // Properties API endpoints
        /middleware // Property specific middleward
        /utils // Property specific utils
        /watchers // Property Firebase event watchers
        /pubsub // Property message broker subscribers
        index.js // Exports the properties module
    /reg-token // Push notification token feature
    /scripts // Development & migration scripts
    /slack // Slack integration feature
    /teams // Teams feature
    /template-categories // Template category feature
    /test // E2E & integration
    /test-helpers // utils for tests
    /trello // Trello feature
    /users // User management feature
    /utils // Globally accessable utilities
    index.js // Firebase Functions configurations
    router.js // API router
```

## Code Styling

- [Airbnb JS code style convention system](https://github.com/airbnb/javascript#table-of-contents).

## Commenting

- Use `// comments` before complicated logic. Facilitate easy skimming of your code and be considerate of the next developer that must work with your code.
- Use [JS DocBlock standards](https://devdocs.magento.com/guides/v2.4/coding-standards/docblock-standard-javascript.html) for documenting parameter types and return values (when Typescript is not used)
