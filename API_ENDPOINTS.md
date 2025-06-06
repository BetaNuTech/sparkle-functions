# Sparkle Functions API Endpoints Documentation

This document lists all API endpoints available in the Sparkle Functions application with their methods, authentication requirements, and purposes.

## Authentication Legend

- **Any Auth**: Requires any authenticated user
- **Admin**: Admin users only
- **Admin + Corporate**: Admin or corporate users
- **Multi-Role**: Admin, corporate, team, or property-level users
- **Trello Auth**: Requires Trello integration authentication
- **No Auth**: No authentication required

---

## Client Management

### GET `/v0/versions`
**Auth**: Any Auth  
**Purpose**: Get latest published client app versions  
**Legacy alias**: `/v0/clients/versions`

### POST `/v0/clients/errors`
**Auth**: Any Auth  
**Purpose**: Create client error report for debugging and monitoring

---

## Inspections

### POST `/v0/properties/:propertyId/inspections`
**Auth**: Multi-Role  
**Purpose**: Create a new inspection for a specific property

### PATCH `/v0/inspections/:inspectionId/template`
**Auth**: Multi-Role + Property Auth Setup  
**Purpose**: Update inspection items/template data  
**Features**: Triggers PDF report generation via Pub/Sub

### POST `/v0/inspections/:inspectionId/template/items/:itemId/image`
**Auth**: Multi-Role + Property Auth Setup  
**Content-Type**: multipart/form-data  
**Purpose**: Upload an image to a specific inspection item

### PATCH `/v0/inspections/:inspectionId`
**Auth**: Admin  
**Purpose**: Reassign inspection to different property

### PATCH `/v0/inspections/:inspectionId/report-pdf`
**Auth**: Multi-Role + Property Auth Setup  
**Purpose**: Generate or regenerate PDF report for completed inspection  
**Features**: Triggers PDF generation via Pub/Sub

### GET `/v0/inspections/latest-completed`
**Auth**: No Auth (TODO: needs auth)  
**Purpose**: Get the most recently completed inspection

---

## Templates

### POST `/v0/templates`
**Auth**: Admin + Corporate  
**Purpose**: Create a new inspection template

### PATCH `/v0/templates/:templateId`
**Auth**: Admin + Corporate  
**Purpose**: Update an existing inspection template

### DELETE `/v0/templates/:templateId`
**Auth**: Admin  
**Purpose**: Delete an inspection template

---

## Template Categories

### POST `/v0/template-categories`
**Auth**: Admin + Corporate  
**Purpose**: Create a new template category for organizing templates

### PATCH `/v0/template-categories/:templateCategoryId`
**Auth**: Admin + Corporate  
**Purpose**: Update an existing template category

### DELETE `/v0/template-categories/:templateCategoryId`
**Auth**: Admin + Corporate  
**Purpose**: Delete a template category

---

## Properties

### POST `/v0/properties`
**Auth**: Admin  
**Purpose**: Create a new property in the system

### PUT `/v0/properties/:propertyId`
**Auth**: Admin + Corporate  
**Purpose**: Update property information and settings

### POST `/v0/properties/:propertyId/image`
**Auth**: Admin + Corporate  
**Content-Type**: multipart/form-data  
**Purpose**: Upload property logo/image to storage

### GET `/v0/properties/:propertyId/yardi/residents`
**Auth**: Multi-Role + Property Code + Yardi Integration  
**Purpose**: Fetch current residents from Yardi property management system

### GET `/v0/properties/:propertyId/yardi/work-orders`
**Auth**: Multi-Role + Property Code + Yardi Integration  
**Purpose**: Fetch work orders from Yardi property management system

---

## Deficiencies

### PUT `/v0/deficiencies`
**Auth**: Multi-Role + Deficiency Auth Setup  
**Purpose**: Batch update one or more deficient items  
**Features**: Supports progress note notifications if enabled

### POST `/v0/deficiencies/:deficiencyId/image`
**Auth**: Multi-Role + Deficiency Auth Setup  
**Content-Type**: multipart/form-data  
**Purpose**: Upload image documentation for a deficiency

### POST `/v0/deficiencies/:deficiencyId/trello/card`
**Auth**: Multi-Role + Deficiency Auth Setup + Trello Auth  
**Purpose**: Create a Trello card for tracking deficiency resolution

---

## Jobs & Bids

### POST `/v0/properties/:propertyId/jobs`
**Auth**: Multi-Role  
**Purpose**: Create a new job/work order for a property

### PUT `/v0/properties/:propertyId/jobs/:jobId`
**Auth**: Multi-Role  
**Purpose**: Update job information and status

### POST `/v0/properties/:propertyId/jobs/:jobId/bids`
**Auth**: Multi-Role  
**Purpose**: Create a new bid for a job

### PUT `/v0/properties/:propertyId/jobs/:jobId/bids/:bidId`
**Auth**: Multi-Role  
**Purpose**: Update bid information and status

### POST `/v0/properties/:propertyId/jobs/:jobId/trello`
**Auth**: Multi-Role + Trello Auth  
**Purpose**: Create a Trello card for job tracking

---

## User Management

### POST `/v0/users`
**Auth**: Any Auth + User CRUD Middleware  
**Purpose**: Create a new user account in the system

### PATCH `/v0/users/:userId`
**Auth**: Any Auth  
**Purpose**: Update user profile and settings

### DELETE `/v0/users/:userId`
**Auth**: Any Auth + User CRUD Middleware  
**Purpose**: Delete a user account from the system

---

## Team Management

### POST `/v0/teams`
**Auth**: Admin  
**Purpose**: Create a new team for organizing users

### PATCH `/v0/teams/:teamId`
**Auth**: Admin  
**Purpose**: Update team information and membership

### DELETE `/v0/teams/:teamId`
**Auth**: Admin  
**Purpose**: Delete a team from the system

---

## Slack Integration

### POST `/v0/integrations/slack/authorization`
**Auth**: Admin  
**Purpose**: Authorize Slack API credentials for workspace integration

### PATCH `/v0/integrations/slack/authorization`
**Auth**: Admin  
**Purpose**: Update Slack integration settings

### DELETE `/v0/integrations/slack/authorization`
**Auth**: Admin  
**Purpose**: Remove Slack app from workspace and delete credentials

### POST `/v0/integrations/slack/events`
**Auth**: No Auth (Slack webhook)  
**Purpose**: Webhook endpoint for Slack events (messages, mentions, etc.)

---

## Trello Integration

### POST `/v0/integrations/trello/authorization`
**Auth**: Admin  
**Purpose**: Authorize Trello API credentials for board integration

### DELETE `/v0/integrations/trello/authorization`
**Auth**: Admin  
**Purpose**: Remove Trello API credentials and all integrations

### GET `/v0/integrations/trello/boards`
**Auth**: Admin + Trello Auth  
**Purpose**: Fetch all available Trello boards for the authenticated user

### GET `/v0/integrations/trello/boards/:boardId/lists`
**Auth**: Admin + Trello Auth  
**Purpose**: Fetch all lists within a specific Trello board

### PUT `/v0/integrations/trello/properties/:propertyId`
**Auth**: Admin + Trello Auth  
**Purpose**: Create or update Trello integration settings for a property

### DELETE `/v0/integrations/trello/properties/:propertyId`
**Auth**: Admin + Trello Auth  
**Purpose**: Remove Trello integration from a property

---

## Documentation

### GET `/docs`
**Auth**: No Auth  
**Purpose**: Swagger/OpenAPI documentation interface for all endpoints

---

## Middleware Details

### Property Auth Setup
Applied to deficiency and inspection endpoints to ensure users have proper access to the associated property.

### User CRUD Middleware
Validates permissions for user creation and deletion operations.

### Trello Auth
Validates that the user has configured and authenticated Trello API credentials.

### File Parser
Handles multipart/form-data file uploads for image endpoints.

---

## Response Patterns

- Most endpoints return JSON responses
- File upload endpoints accept multipart/form-data
- Error responses follow standard HTTP status codes
- Authentication failures return 401/403 status codes
- Validation errors return 400 status codes with descriptive messages

## Integration Points

- **Pub/Sub**: Inspection updates trigger PDF generation and other async processes
- **Storage**: Images uploaded to Google Cloud Storage
- **External APIs**: Yardi, Slack, and Trello integrations for external system coordination