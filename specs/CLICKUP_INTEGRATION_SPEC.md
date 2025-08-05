# ClickUp Integration Specification

## Overview

This document serves as the comprehensive specification for the ClickUp integration in Sparkle Functions. It captures the current implementation status, architectural decisions, and remaining work needed to complete the ClickUp integration. While Trello integration remains in the codebase, it is not currently in use, and no migration from Trello is required.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Status](#implementation-status)
3. [API Endpoints](#api-endpoints)
4. [Background Services (Pub/Sub)](#background-services-pubsub)
5. [Data Models](#data-models)
6. [Configuration](#configuration)
7. [Security & Authentication](#security--authentication)
8. [Testing Strategy](#testing-strategy)
9. [Migration Plan](#migration-plan)
10. [Remaining Work](#remaining-work)

## Architecture Overview

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Auth      │  │   Spaces    │  │   Tasks     │        │
│  │  Endpoints  │  │  Endpoints  │  │  Endpoints  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌─────────────────────────────────────────────────┐       │
│  │           ClickUp Service (clickup.js)           │       │
│  │  - API Client                                    │       │
│  │  - Token Encryption/Decryption                   │       │
│  │  - Request Handling & Rate Limiting              │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   System    │  │Integrations │  │ Deficiencies│        │
│  │   Model     │  │    Model    │  │    Model    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
functions/
├── clickup/
│   ├── index.js                    # Module exports
│   ├── api/
│   │   ├── post-auth.js           # Store ClickUp credentials
│   │   ├── delete-auth.js         # Remove ClickUp integration
│   │   ├── get-workspaces.js      # Fetch workspaces
│   │   ├── get-spaces.js          # Fetch spaces
│   │   ├── get-lists.js           # Fetch lists
│   │   ├── put-property-integration.js
│   │   ├── delete-property-integration.js
│   │   ├── post-deficiency-task.js
│   │   └── post-job-task.js
│   └── utils/
│       ├── index.js
│       ├── build-task-comment.js
│       ├── create-task-from-deficiency.js
│       ├── create-task-from-job.js
│       ├── get-best-status-match.js
│       └── map-sparkle-status-to-clickup.js
├── services/
│   └── clickup.js                 # Core ClickUp API service
├── config/
│   └── clickup.js                 # ClickUp-specific configuration
├── deficient-items/
│   └── pubsub/
│       ├── clickup-task-state-comment-v2.js
│       ├── clickup-task-progress-note-v2.js
│       ├── clickup-task-due-date-v2.js (TODO)
│       └── clickup-task-close-v2.js (TODO)
├── jobs/
│   └── pubsub/
│       └── clickup-task-state-update-v2.js
└── test/
    └── integration/
        └── clickup/
            └── [test files]
```

## Implementation Status

### ✅ Completed Components

#### 1. Core Service Layer (`services/clickup.js`)
- API client with authentication using `got` HTTP library
- Request methods for all required endpoints
- Error handling and retry logic
- Singleton pattern for service instance
- Note: No encryption currently implemented (stores tokens as plain text)

#### 2. Authentication Endpoints
- **POST** `/v0/integrations/clickup/authorization` - Store API credentials
- **DELETE** `/v0/integrations/clickup/authorization` - Remove integration

#### 3. Workspace Management Endpoints
- **GET** `/v0/integrations/clickup/workspaces` - Fetch workspaces
- **GET** `/v0/integrations/clickup/workspaces/:workspaceId/spaces` - Fetch spaces
- **GET** `/v0/integrations/clickup/lists` - Browse lists with query params

#### 4. Property Integration Endpoints
- **PUT** `/v0/integrations/clickup/properties/:propertyId` - Configure property
- **DELETE** `/v0/integrations/clickup/properties/:propertyId` - Remove config

#### 5. Task Creation Endpoints
- **POST** `/v0/properties/:propertyId/deficiencies/:deficiencyId/clickup/task`
- **POST** `/v0/properties/:propertyId/jobs/:jobId/clickup/task`

#### 6. Utility Functions
- Task creation helpers for deficiencies and jobs
- Status mapping between Sparkle and ClickUp
- Comment building for state transitions
- Best status match algorithm

#### 7. Configuration Structure
- Environment variable mapping
- Template configuration for tasks and comments
- Custom field ID configuration

### 🚧 In Progress Components

#### 1. Pub/Sub Functions
- `clickup-task-state-comment-v2.js` - Created but not exported
- `clickup-task-progress-note-v2.js` - Created but not exported
- Need to add exports to main `index.js`

#### 2. Authentication Middleware
- `auth-clickup-request.js` exists but needs proper integration in router

### ❌ Not Yet Implemented

#### 1. Missing Pub/Sub Handlers
- `clickup-task-due-date-v2.js` - Due date synchronization
- `clickup-task-close-v2.js` - Task closure/completion

#### 2. Webhook Support
- Webhook endpoint for ClickUp events
- Webhook signature validation
- Event processing logic

#### 3. User Mapping
- Mapping Sparkle users to ClickUp user IDs
- Assignee synchronization via email matching
- Email addresses are available in our workspace

#### 4. Custom Fields
- Dynamic custom field discovery
- Field value mapping and validation
- Custom field IDs must be configured per workspace

## API Limitations & Clarifications

### ClickUp API Constraints
1. **Rate Limits**: Vary by plan (100/min for free, higher for paid)
2. **User Emails**: Available in our workspace (confirmed via testing)
3. **Bulk Operations**: No bulk task creation endpoint
4. **Webhook Limits**: Limited events compared to Trello
5. **Custom Fields**: IDs are workspace-specific, not global
6. **Status Constraints**: Can't create custom statuses in "closed" group
7. **Team vs Workspace**: API uses "team", UI shows "workspace" (same thing)

## API Endpoints

### Authentication & Setup

#### Store ClickUp Credentials
```http
POST /v0/integrations/clickup/authorization
Content-Type: application/json
Authorization: Bearer {token}

{
  "apiToken": "pk_12345678_ABCDEFGHIJKLMNOP",
  "workspaceId": "12345678"
}
```

**Response:**
```json
{
  "data": {
    "id": "clickup",
    "type": "clickup-authorization",
    "attributes": {
      "workspace": {
        "id": "12345678",
        "name": "My Workspace"
      },
      "user": {
        "id": 183,
        "username": "john",
        "email": "john@example.com"
      }
    }
  }
}
```

#### Remove ClickUp Integration
```http
DELETE /v0/integrations/clickup/authorization
Authorization: Bearer {token}
```

### Workspace Management

#### Get Workspaces
```http
GET /v0/integrations/clickup/workspaces
Authorization: Bearer {token}
```

**Note**: ClickUp API calls these "teams" but the UI shows "workspaces". They are the same thing.

#### Get Spaces
```http
GET /v0/integrations/clickup/workspaces/{workspaceId}/spaces
Authorization: Bearer {token}
```

**Note**: Spaces are containers within a workspace that hold folders and lists.

#### Get Lists and Folders
```http
GET /v0/integrations/clickup/lists?spaceId={spaceId}
GET /v0/integrations/clickup/lists?folderId={folderId}
Authorization: Bearer {token}
```

**Response Structure:**
- Returns both folders and lists in a single response
- Folders are listed first (type: `clickup-folder`)
- Lists follow folders (type: `clickup-list`)
- When querying by `spaceId`: Returns all folders in the space AND lists not in folders
- When querying by `folderId`: Returns only lists within that specific folder
- Each list includes detailed status information after fetching additional details

**Example Response:**
```json
{
  "data": [
    {
      "id": "folder123",
      "type": "clickup-folder",
      "attributes": {
        "name": "Property Maintenance",
        "hidden": false,
        "taskCount": 15
      }
    },
    {
      "id": "list456",
      "type": "clickup-list",
      "attributes": {
        "name": "Active Deficiencies",
        "orderindex": 0,
        "status": null,
        "priority": null,
        "assignee": null,
        "statuses": [
          { "status": "TO DO", "color": "#d3d3d3", "type": "open" },
          { "status": "IN PROGRESS", "color": "#4194f6", "type": "custom" },
          { "status": "COMPLETE", "color": "#6bc950", "type": "closed" }
        ]
      }
    }
  ]
}
```

### Property Configuration

#### Configure Property Integration
```http
PUT /v0/integrations/clickup/properties/{propertyId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "spaceId": "90110336669",
  "activeListId": "901100754275",
  "completedListId": "901100754276",
  "deferredListId": "901100754277"
}
```

### Task Management

#### Create Deficiency Task
```http
POST /v0/properties/{propertyId}/deficiencies/{deficiencyId}/clickup/task
Authorization: Bearer {token}
```

**ClickUp API Calls Made**:
1. `POST /api/v2/list/{listId}/task` - Create the task
2. `POST /api/v2/task/{taskId}/attachment` - Upload photos (if any)

#### Create Job Task
```http
POST /v0/properties/{propertyId}/jobs/{jobId}/clickup/task
Authorization: Bearer {token}
```

**ClickUp API Calls Made**:
1. `POST /api/v2/list/{listId}/task` - Create the task

## Background Services (Pub/Sub)

### Deficiency State Updates

#### Topic: `deficient-item-status-update`

**Handlers:**
1. **State Comments** (`clickup-task-state-comment-v2.js`)
   - Adds comments for state transitions
   - Uses templates from configuration
   - Includes user information and timestamps

2. **Progress Notes** (`clickup-task-progress-note-v2.js`)
   - Syncs progress notes to ClickUp comments
   - Triggered on progress note additions

3. **Due Dates** (`clickup-task-due-date-v2.js`) - TODO
   - Updates task due dates based on state
   - Handles deferred date logic
   - Respects timezone settings

4. **Task Closure** (`clickup-task-close-v2.js`) - TODO
   - Moves tasks to completed list
   - Updates task status
   - Archives if configured

### Job State Updates

#### Topic: `job-status-update`

**Handler:** `clickup-task-state-update-v2.js`
- Updates task status based on job state
- Handles bid approval updates
- Syncs vendor assignments

## Data Models

### System Collection

**Document ID:** `clickup`

```javascript
{
  apiToken: "pk_12345678_ABCDEFGHIJKLMNOP",  // Plain text personal API token
  workspaceId: "12345678",
  workspaceName: "My Workspace",
  user: "firebase-user-id",                   // Firebase user ID who configured it
  createdAt: 1234567890,
  updatedAt: 1234567890
}
```

### Integrations Collection

**Document ID:** `clickup`

```javascript
{
  member: "183",                              // ClickUp member ID
  clickupUsername: "john_doe",                // ClickUp username
  clickupEmail: "john@example.com",           // ClickUp email (may be empty)
  clickupWorkspaceName: "My Workspace",       // Workspace name
  workspaceId: "12345678",                    // Workspace ID
  workspaceName: "My Workspace",              // Duplicate for compatibility
  workspaceColor: "#7b68ee",                  // Workspace color
  workspaceAvatar: "https://...",             // Workspace avatar URL or null
  availableWorkspaces: [                      // All workspaces user has access to
    {
      id: "12345678",
      name: "My Workspace",
      color: "#7b68ee",
      avatar: "https://..."
    }
  ],
  createdAt: 1234567890,
  updatedAt: 1234567890
}
```

**Document ID:** `clickup-{propertyId}`

```javascript
{
  spaceId: "90110336669",
  spaceName: "Property Name",
  activeListId: "901100754275",
  activeListName: "Active Items",
  completedListId: "901100754276",
  completedListName: "Completed Items",
  deferredListId: "901100754277",
  deferredListName: "Deferred Items",
  grantedBy: "user123",
  grantedAt: 1234567890,
  updatedAt: 1234567890
}
```

### Task Mappings

**System Collection Document ID:** `clickup-{propertyId}`

```javascript
{
  tasks: {
    "abc123": "deficiency-id-123",
    "def456": "job-id-456"
  }
}
```

## Configuration

### Multi-Tenant Token Storage

**Important**: This integration uses a multi-tenant architecture where each organization stores their own ClickUp API token in Firestore. There are NO environment variables for API tokens.

#### How API Tokens are Stored:
1. **Per-Organization Storage**: Each organization configures their own ClickUp integration
2. **Storage Location**: Firestore `system` collection, document ID: `clickup`
3. **Token Format**: Personal API token (starts with `pk_`)
4. **No Encryption**: Tokens are stored as plain text (matching Trello implementation)
5. **Access Control**: Only accessible via server-side code with Firestore admin credentials

#### Token Flow:
```
1. Admin user calls POST /v0/integrations/clickup/authorization
2. Provides their ClickUp personal API token
3. System validates token with ClickUp API
4. Token stored in Firestore system/clickup document
5. All subsequent API calls use this stored token
```

### Future Environment Variables (Not Yet Implemented)

The following environment variables are planned for future implementation to support custom field mapping:

```bash
# Custom Field IDs (per workspace) - FUTURE IMPLEMENTATION
# These would allow dynamic mapping of Sparkle fields to ClickUp custom fields
# without hardcoding field IDs in the source code.
CLICKUP_FIELD_PROPERTY_NAME=field_id_1      # Would map property name to custom field
CLICKUP_FIELD_PROPERTY_ADDRESS=field_id_2   # Would map property address
CLICKUP_FIELD_UNIT=field_id_3               # Would map unit number
CLICKUP_FIELD_CATEGORY=field_id_4           # Would map deficiency category
CLICKUP_FIELD_SEVERITY=field_id_5           # Would map severity/score
CLICKUP_FIELD_RESPONSIBILITY=field_id_6     # Would map responsibility group
CLICKUP_FIELD_INSPECTION_DATE=field_id_7    # Would map inspection date
CLICKUP_FIELD_INSPECTOR=field_id_8          # Would map inspector name
CLICKUP_FIELD_JOB_TYPE=field_id_9          # Would map job type
CLICKUP_FIELD_VENDOR=field_id_10           # Would map vendor assignment
CLICKUP_FIELD_APPROVED_AMOUNT=field_id_11  # Would map approved bid amount
```

#### Custom Field Variables (Future Implementation)
The `CLICKUP_FIELD_*` variables are designed for future enhancement where:

1. **Dynamic Field Mapping**: Instead of hardcoding ClickUp custom field IDs in the source code, these environment variables would allow each Sparkle deployment to map their specific ClickUp workspace's custom fields.

2. **Why Custom Fields?**: ClickUp allows workspaces to create custom fields for additional data. Since each workspace has different field IDs, we need a way to configure which Sparkle data maps to which ClickUp field.

3. **Example Use Case**:
   - Sparkle stores "property name" as a standard field
   - ClickUp workspace has a custom field called "Property" with ID "abc123"
   - Set `CLICKUP_FIELD_PROPERTY_NAME=abc123`
   - The integration would then know to put the property name in that custom field

4. **Current State**: The integration currently uses ClickUp's standard task fields (name, description, status, etc.) and does NOT implement custom field mapping yet.

### Configuration Files

#### `config/clickup.js`
Contains all ClickUp-specific configuration including:
- Task description templates (using Handlebars syntax)
- State transition comment templates
- Status mappings between Sparkle states and ClickUp statuses
- Priority mappings
- Default settings
- Tag configurations
- Recommended status configurations for lists

**Key Configuration Elements:**
- `deficientItemTaskDescriptionTemplate`: Handlebars template for deficiency tasks
- `jobTaskDescriptionTemplate`: Handlebars template for job tasks
- `deficientItemCommentTemplates`: Templates for each state transition
- `deficientItemStatusMapping`: Maps Sparkle states to ClickUp statuses
- `jobStatusMapping`: Maps job states to ClickUp statuses
- `priorityMapping`: Maps numeric priorities (1-5 scale to ClickUp's 1-4 scale)

## Security & Authentication

### Multi-Tenant Architecture
- Each organization configures their own ClickUp integration
- API tokens are stored per-organization in Firestore
- Multiple organizations can use the same Sparkle instance with different ClickUp workspaces

### Token Storage
- **Collection**: System collection (server-side access only)
- **Document**: `system/clickup`
- **Storage Format**: Plain text (no encryption)
- **Access**: Only accessible via Firebase Admin SDK
- **Consistency**: Matches Trello implementation approach

### Request Authentication
1. **User Authentication**: Firebase Auth required
2. **Role-Based Access**: 
   - Admin role required for configuration endpoints
   - Multi-role access for task creation endpoints
3. **Integration Check**: `authClickUpReq` middleware verifies configuration exists
4. **Property Permissions**: Task operations check property-level access

### Middleware Chain
```javascript
// Configuration endpoints (admin only)
authUser(db, auth, true)         // Require admin
authClickUpReq(db)               // Verify ClickUp configured

// Task creation endpoints (multi-role)
authUser(db, auth, {
  admin: true,
  corporate: true,
  team: true,
  property: true
})
authClickUpReq(db)               // Verify ClickUp configured
```

### Security Considerations
- **Firestore Security**: Relies on Firestore's built-in security and encryption at rest
- **No Client Access**: System collection is never exposed to client-side code
- **Token Scope**: Personal API tokens have full access to user's ClickUp workspace
- **Audit Trail**: All configuration changes tracked with user ID and timestamp

## ClickUp vs Trello Implementation Differences

### Key Architectural Differences

1. **List/Status Management**
   - **Trello**: Cards move between physical lists (open/closed boards)
   - **ClickUp**: Tasks stay in one list, only status changes

2. **Property Configuration**
   - **Trello**: Stores `openBoard`, `openList`, `closedBoard`, `closedList`
   - **ClickUp**: Stores only `listId` (optionally `spaceId`, `folderId`)

3. **State Tracking**
   - **Trello**: Complex card movement and archiving logic
   - **ClickUp**: Simple status field updates

4. **API Patterns**
   - **Trello**: Separate calls for cards, attachments, comments
   - **ClickUp**: More unified API, can include everything in task creation

### Implementation Advantages

1. **Simpler State Management**: No need to move tasks between lists
2. **Better Metadata Support**: Custom fields, priorities, multiple assignees
3. **Rich Content**: Markdown descriptions, better formatting
4. **Built-in Workflows**: Status-based workflows are native to ClickUp

## Testing Strategy (TDD Approach)

### Test-Driven Development Process
**IMPORTANT**: Tests should be written BEFORE implementation following TDD principles:
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while tests pass

### Unit Tests (Write First!)
**Coverage Target**: 95%+ for all new code

#### Service Layer Tests
```javascript
// Example: services/clickup.test.js
describe('ClickUp Service', () => {
  it('should fetch teams with valid token', async () => {
    // Mock API response
    nock('https://api.clickup.com')
      .get('/api/v2/team')
      .reply(200, { teams: [{ id: '123', name: 'Test' }] });
    
    const result = await clickup.fetchTeams('pk_valid');
    expect(result.teams).to.have.length(1);
  });
  
  it('should handle 401 unauthorized', async () => {
    nock('https://api.clickup.com')
      .get('/api/v2/team')
      .reply(401);
    
    await expect(clickup.fetchTeams('invalid'))
      .to.be.rejectedWith('unauthorized');
  });
});
```

#### Utility Function Tests
- Status mapping (all state transitions)
- Comment template generation
- Task creation helpers

### Integration Tests
**Run against test Firestore instance**

#### API Endpoint Tests
```javascript
// Example: test/integration/clickup/api-post-auth.test.js
describe('POST /v0/integrations/clickup/authorization', () => {
  beforeEach(async () => {
    // Setup test database
    await clearTestData();
  });
  
  it('should store valid ClickUp token', async () => {
    const response = await request(app)
      .post('/v0/integrations/clickup/authorization')
      .set('Authorization', 'Bearer admin-token')
      .send({ apiToken: 'pk_test123' })
      .expect(201);
    
    // Verify database state
    const systemDoc = await systemModel.findClickUp(db);
    expect(systemDoc.exists).to.be.true;
  });
});
```

#### Pub/Sub Handler Tests
- Mock Pub/Sub messages
- Verify state changes
- Test error scenarios

### End-to-End Tests
- Complete workflows with real ClickUp test workspace
- Performance benchmarks
- Rate limit testing

### Test Data Management
- Use factory functions for test data
- Clean database between tests
- Separate test ClickUp workspace

### Test Files Created
```
test/integration/clickup/
├── api-delete-auth.test.js
├── api-delete-property-integration.test.js
├── api-get-lists.test.js
├── api-get-spaces.test.js
├── api-get-workspaces.test.js
├── api-post-auth.test.js
├── api-post-deficiency-task.test.js
├── api-post-job-task.test.js
└── api-put-property-integration.test.js
```

## Deployment Plan

### Current Status
- **Single Organization**: Only one organization currently using the system
- **No Active Trello Usage**: Trello integration exists but is not in use
- **No Migration Required**: No existing Trello data to migrate
- **Trello Code**: Remains in codebase as dormant but functional

### Deployment Strategy
1. **Complete ClickUp Implementation**
   - Finish remaining API endpoints
   - Implement missing Pub/Sub handlers
   - Complete testing suite

2. **Configuration**
   - Configure ClickUp workspace for the organization
   - Set up custom fields if needed
   - Configure lists and statuses

3. **Rollout**
   - Deploy ClickUp integration
   - Configure for active properties
   - Monitor usage and performance

4. **Future Considerations**
   - Trello code remains available if needed
   - Both integrations can coexist
   - Each property can choose their integration

## Risk Mitigation

### Technical Risks
1. **ClickUp API Rate Limits**
   - Implement retry logic with exponential backoff
   - Add request queuing for bulk operations
   - Monitor rate limit headers in responses

2. **Integration Failures**
   - Comprehensive error handling
   - Implement circuit breaker pattern
   - Monitor API health and response times
   - Have manual fallback procedures

### Business Risks
1. **User Adoption**
   - Provide clear migration documentation
   - Offer training sessions
   - Maintain support channels
   - Create video tutorials

2. **Downtime**
   - Deploy during low-usage periods
   - Have rollback plan ready
   - Use feature flags for gradual rollout
   - Monitor system health metrics

## Current Implementation Status

### Active Todo List (As of Project Start)

#### ✅ Completed
- [x] Update spec with correct environment variables and explanations
- [x] Remove migration script todo - not needed

#### 🚧 In Progress
- [ ] Add ClickUp pubsub functions to main index.js exports

#### 📋 High Priority (Must Complete)
1. [ ] **Write tests FIRST for missing pubsub handlers (TDD)**
2. [ ] **Complete ClickUp API endpoints implementation**
3. [ ] **Implement missing ClickUp pubsub handlers for due dates and task closure**
4. [ ] **Update router.js to add missing ClickUp auth middleware**
5. [ ] **Create unit tests for ClickUp service layer**
6. [ ] **Complete integration tests for all ClickUp endpoints**
7. [ ] **Update environment configuration with ClickUp settings**
8. [ ] **Fix auth middleware implementation in router.js**
9. [ ] **Run and fix any failing tests**

#### 📋 Medium Priority
10. [ ] **Implement user mapping functionality for ClickUp assignees**
    - Email addresses are available for users in our workspace
    - Can map Sparkle users to ClickUp users via email matching
11. [ ] **Add custom field configuration and mapping**
12. [ ] **Test photo upload functionality for deficiencies**
13. [ ] **Implement deleted task error handling**
14. [ ] **Add rate limit retry logic with exponential backoff**

#### 📋 Low Priority
15. [ ] **Implement webhook endpoints for ClickUp events**
16. [ ] **Create comprehensive ClickUp Integration Analysis document**

## Remaining Work Details

### High Priority Tasks

1. **Write Tests First (TDD)** (4-6 hours)
   - Unit tests for all service methods
   - Integration tests for all endpoints
   - Pub/Sub handler tests
   - **Must be done BEFORE implementation**

2. **Export Pub/Sub Functions** (2 hours)
   - Add ClickUp pub/sub exports to `functions/index.js`
   - Test message processing

3. **Implement Missing Pub/Sub Handlers** (4-6 hours)
   - Create `clickup-task-due-date-v2.js`
   - Create `clickup-task-close-v2.js`
   - Add proper list movement logic

4. **Fix Authentication Middleware** (1 hour)
   - Ensure `authClickUpReq` is properly checking integration status
   - Add to appropriate routes in `router.js`

5. **Environment Configuration** (1 hour)
   - Document required environment variables
   - Create `.env.example` for ClickUp settings
   - Update deployment documentation

### Medium Priority Tasks

5. **Complete Test Coverage** (8-10 hours)
   - Unit tests for service layer
   - Integration tests for all endpoints
   - Pub/Sub handler tests

6. **User Mapping** (4-6 hours)
   - Create user mapping interface
   - Implement assignee synchronization
   - Handle email-based matching

7. **Custom Field Support** (4-6 hours)
   - Dynamic field discovery
   - Configuration interface
   - Value mapping logic

8. **Photo Upload Testing** (2-3 hours)
   - Verify attachment upload works
   - Test with various file types
   - Handle large files

### Low Priority Tasks

9. **Webhook Implementation** (6-8 hours)
   - Create webhook endpoint
   - Implement signature validation
   - Process ClickUp events
   - Handle bi-directional sync

10. **Documentation & Training** (4-6 hours)
    - Create user documentation
    - API endpoint documentation
    - Configuration guides
    - Training materials

### Estimated Total Time
- High Priority: ~8 hours
- Medium Priority: ~25 hours
- Low Priority: ~14 hours
- **Total: ~47 hours**

## Error Handling Specifications

### API Error Codes
- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Invalid or missing API token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Task/List/Space not found
- **409 Conflict**: Resource already exists (e.g., task already created)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error

### Custom Error Handling

#### Deleted Task Handling
```javascript
// Similar to Trello's ERR_TRELLO_CARD_DELETED
if (error.response?.status === 404) {
  // Clean up task reference in system collection
  await systemModel.removeClickUpTaskMapping(propertyId, taskId);
  throw new Error('ERR_CLICKUP_TASK_DELETED');
}
```

#### Rate Limit Handling
```javascript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'] || 60;
  // Implement exponential backoff
  await delay(retryAfter * 1000);
  return retry(request);
}
```

### Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "ERR_CLICKUP_SPECIFIC_ERROR",
  "details": {
    "field": "specific field that caused error"
  }
}

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] ClickUp workspace prepared with custom fields
- [ ] Security review completed
- [ ] Performance testing done

### Deployment Steps
1. Deploy functions with ClickUp disabled
2. Configure environment variables
3. Test authentication flow
4. Enable for test property
5. Monitor logs and performance
6. Gradual rollout to other properties

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check API response times
- [ ] Verify task synchronization
- [ ] Gather user feedback
- [ ] Document known issues

## Success Criteria

### Definition of Done
- [ ] All unit tests passing with 95%+ coverage
- [ ] All integration tests passing
- [ ] API response times < 2 seconds
- [ ] Zero security vulnerabilities
- [ ] Documentation complete
- [ ] Code reviewed and approved
- [ ] Deployed to production successfully

### Performance Requirements
- **API Response Time**: < 2 seconds for all endpoints
- **Task Creation**: < 3 seconds including photo uploads
- **Bulk Operations**: Handle 100+ items without timeout
- **Rate Limiting**: Graceful handling with retry
- **Memory Usage**: < 512MB per function execution

### Monitoring & Logging
- **Error Tracking**: All errors logged with context
- **Performance Metrics**: Response times tracked
- **Usage Analytics**: Track API calls per property
- **Health Checks**: Monitor ClickUp API availability
- **Alerts**: Set up for error rates > 1%

## Database Indexes Required

1. **Deficiencies Collection**:
   - Index on `clickUpTaskId` for quick lookups
   - Index on `clickUpTaskURL` for URL searches
   - Compound index on `property` + `state` for queries

2. **Jobs Collection**:
   - Index on `clickUpTaskId`
   - Index on `clickUpTaskURL`

3. **System Collection**:
   - Index on document ID pattern `clickup-*`

## Development Environment Setup

1. **Prerequisites**:
   - Node.js v10.x (use Docker if needed)
   - Firebase CLI
   - Access to test Firestore project

2. **Setup Steps**:
   ```bash
   # Clone repository
   git clone [repo-url]
   cd sparkle-functions/functions
   
   # Install dependencies
   npm install
   
   # Set up environment
   cp .env.example .env.test
   # Edit .env.test with test credentials
   
   # Run tests
   npm test
   
   # Start development server
   npm run dev
   ```

3. **ClickUp Test Workspace**:
   - Create separate workspace for testing
   - Set up test lists and custom fields
   - Generate test API token

## Appendix

### ClickUp API Resources
- [API Documentation](https://clickup.com/api)
- [Authentication Guide](https://clickup.com/api/authentication)
- [Webhook Documentation](https://clickup.com/api/webhooks)
- [Rate Limits](https://clickup.com/api/ratelimits)

### Internal Resources
- Trello implementation reference: `/functions/trello/`
- Trello integration analysis: `/TRELLO_INTEGRATION_ANALYSIS.md`
- This specification: `/specs/CLICKUP_INTEGRATION_SPEC.md`