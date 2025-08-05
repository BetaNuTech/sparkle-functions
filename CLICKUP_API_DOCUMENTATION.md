# ClickUp API Documentation for Trello Migration

## Overview

This document outlines the ClickUp API endpoints and implementation requirements for migrating Sparkle Functions from Trello to ClickUp. ClickUp provides a comprehensive REST API v2 that supports all the functionality needed to replicate and enhance the current Trello integration.

## Authentication

### Personal API Token (Initial Implementation)
- Generate token from ClickUp Settings > Apps > API Token
- Format: `pk_[token]`
- Header: `Authorization: pk_[personal_token]`
- Tokens never expire
- Suitable for single-user/admin operations

### OAuth 2.0 (Future Enhancement)
- Required for multi-user applications
- Flow: Authorization URL → Code → Access Token
- Header: `Authorization: Bearer [access_token]`
- Access tokens currently don't expire
- Better for production multi-tenant scenarios

## Key API Endpoints

### 1. Workspace & Hierarchy Management

#### Get Authorized Teams (Workspaces)
```
GET /api/v2/team
Authorization: [token]
```
Returns list of authorized workspaces for the authenticated user.

#### Get Spaces
```
GET /api/v2/team/{team_id}/space
```
Returns all spaces in a workspace.

#### Get Folders
```
GET /api/v2/space/{space_id}/folder
```
Returns folders within a space.

#### Get Lists
```
GET /api/v2/folder/{folder_id}/list
GET /api/v2/space/{space_id}/list  (folderless lists)
```
Returns lists within a folder or space.

### 2. Task Management

#### Get List (includes available statuses)
```
GET /api/v2/list/{list_id}
```
Returns list details including available statuses with their names, colors, and order.

**Status Groups:**
- **Active**: Tasks currently being worked on
- **Done**: Tasks done but need to remain open  
- **Closed**: Totally completed tasks (default: "Complete")
- **Not Started**: Optional 4th group (enabled via ClickApp)

**Note**: Custom statuses can be created for all groups except Closed. Statuses inherit from Space > Folder > List hierarchy.

#### Create Task
```
POST /api/v2/list/{list_id}/task
Content-Type: application/json

{
  "name": "Deficiency Title",
  "description": "Detailed description with markdown support",
  "assignees": [user_id],  // Array of user IDs to assign
  "status": "status_name",  // Must match available status in list
  "priority": 1-4,
  "due_date": unix_timestamp,
  "start_date": unix_timestamp,
  "notify_all": true,
  "tags": ["deficiency", "property-123"],
  "custom_fields": [
    {
      "id": "field_id",
      "value": "field_value"
    }
  ]
}
```

#### Update Task (including assignees)
```
PUT /api/v2/task/{task_id}
Content-Type: application/json

{
  "name": "Updated Title",
  "status": "in progress",  // Must match available status
  "priority": 2,
  "due_date": unix_timestamp,
  "assignees": {
    "add": [user_id_1, user_id_2],     // Add new assignees
    "rem": [user_id_3]                  // Remove assignees
  }
}
```

**Note**: To assign/reassign users, use the assignees object with add/rem arrays.

#### Get Task
```
GET /api/v2/task/{task_id}
```

#### Get Tasks in List
```
GET /api/v2/list/{list_id}/task
```
Returns up to 100 tasks per page with pagination.

### 3. Custom Fields

#### Get Accessible Custom Fields
```
GET /api/v2/list/{list_id}/field
```

#### Set Custom Field Value
```
POST /api/v2/task/{task_id}/field/{field_id}

{
  "value": "field_value"
}
```

Custom field types supported:
- Text
- Number
- Boolean (checkbox)
- Drop Down
- Email
- URL
- Phone
- Date
- Labels
- Users
- Tasks (relationships)
- Location (lat/lng/address)
- Progress (manual/automatic)

### 4. Comments

#### Create Comment
```
POST /api/v2/task/{task_id}/comment

{
  "comment_text": "State changed from PENDING to IN_PROGRESS",
  "assignee": user_id,
  "notify_all": false
}
```

#### Get Comments
```
GET /api/v2/task/{task_id}/comment
```

### 5. Attachments

#### Upload Attachment
```
POST /api/v2/task/{task_id}/attachment
Content-Type: multipart/form-data

attachment: [file]
filename: "inspection-photo.jpg"
```

### 6. Webhooks

#### Create Webhook
```
POST /api/v2/team/{team_id}/webhook

{
  "endpoint": "https://yourapp.com/webhook",
  "events": [
    "taskCreated",
    "taskUpdated", 
    "taskStatusUpdated",
    "taskDueDateUpdated",
    "taskDeleted",
    "taskCommentPosted"
  ],
  "space_id": "space_id",
  "folder_id": "folder_id",
  "list_id": "list_id"
}
```

#### Update Webhook
```
PUT /api/v2/webhook/{webhook_id}

{
  "endpoint": "https://newurl.com/webhook",
  "status": "active",
  "events": ["taskUpdated"]
}
```

#### Delete Webhook
```
DELETE /api/v2/webhook/{webhook_id}
```

### 7. Users & Members

#### Get Teams (Workspaces) - Includes Member List
```
GET /api/v2/team
```
Returns authorized workspaces with basic member information including user IDs.

**Note**: This is the primary endpoint to get workspace members. The response includes a `members` array with user data, though email addresses may not be included in the basic response.

#### Get User Details (Enterprise Only)
```
GET /api/v2/team/{team_id}/user/{user_id}
```
**Note**: This endpoint is only available for Enterprise workspaces and may include email addresses.

#### Get Task Members
```
GET /api/v2/task/{task_id}/member
```
Returns members who have access to a specific task.

#### Get List Members  
```
GET /api/v2/list/{list_id}/member
```
Returns members who have access to a specific list.

**Important Email Matching Notes:**
1. The standard API may not return email addresses for all users due to privacy settings
2. For Enterprise plans, the Get User endpoint might provide email details
3. Consider using ClickUp usernames or user IDs for matching instead of emails
4. When creating the integration, store a mapping of ClickUp user IDs to your system's user emails

## Webhook Events & Payloads

### Task Created
```json
{
  "event": "taskCreated",
  "task_id": "abc123",
  "webhook_id": "webhook-uuid",
  "history_items": [{
    "date": "1642736194135",
    "field": "task_creation",
    "user": {
      "id": 183,
      "username": "John",
      "email": "john@example.com"
    }
  }]
}
```

### Task Status Updated
```json
{
  "event": "taskStatusUpdated",
  "task_id": "abc123",
  "webhook_id": "webhook-uuid",
  "history_items": [{
    "field": "status",
    "before": {
      "status": "open",
      "color": "#d3d3d3"
    },
    "after": {
      "status": "in progress",
      "color": "#4194f6"
    },
    "user": {...}
  }]
}
```

### Task Due Date Updated
```json
{
  "event": "taskDueDateUpdated",
  "task_id": "abc123",
  "webhook_id": "webhook-uuid",
  "history_items": [{
    "field": "due_date",
    "before": "1642701600000",
    "after": "1643608800000",
    "data": {
      "due_date_time": true
    },
    "user": {...}
  }]
}
```

## Practical Implementation Examples

### Working with Statuses
```javascript
// 1. Get available statuses for a list
const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
  headers: { 'Authorization': `pk_${apiToken}` }
});
const list = await listResponse.json();
const availableStatuses = list.statuses; // Array of {status, color, orderindex, type}

// 2. Create task with specific status
const createTask = {
  name: "Deficiency: Broken Window",
  status: availableStatuses.find(s => s.type === 'open')?.status || 'open',
  assignees: [clickupUserId]
};

// 3. Update task status
const updateTask = {
  status: availableStatuses.find(s => s.status.toLowerCase() === 'in progress')?.status
};
```

### User Assignment Strategy
```javascript
// 1. Get workspace members on initialization
const teamResponse = await fetch('https://api.clickup.com/api/v2/team', {
  headers: { 'Authorization': `pk_${apiToken}` }
});
const teams = await teamResponse.json();
const members = teams.teams[0].members;

// 2. Create user mapping table (store in database)
const userMapping = {
  sparkleUserId: {
    clickupId: members[0].user.id,
    clickupUsername: members[0].user.username,
    sparkleEmail: 'user@example.com' // From your system
  }
};

// 3. Assign users when creating/updating tasks
const task = {
  name: "Fix HVAC Issue",
  assignees: [userMapping[sparkleUserId].clickupId]
};

// 4. Update assignees on existing task
const updateAssignees = {
  assignees: {
    add: [newUserId1, newUserId2],
    rem: [oldUserId]
  }
};
```

## Implementation Steps

### Phase 1: Core Setup
1. **Authentication Service**
   - Store ClickUp API token securely
   - Implement token validation
   - Create middleware for API authentication

2. **Workspace Configuration**
   - API endpoint to store ClickUp workspace settings
   - Map properties to ClickUp spaces/lists
   - Store list IDs for open/closed items

3. **User Mapping**
   - Fetch ClickUp workspace members
   - Map Sparkle users to ClickUp user IDs
   - Store mapping in database

### Phase 2: Task Creation & Management
1. **Deficiency to Task Conversion**
   - Create tasks from deficient items
   - Set custom fields for metadata
   - Add inspection photos as attachments
   - Assign to appropriate users

2. **Status Synchronization**
   - Map Sparkle states to ClickUp statuses
   - Handle state transitions
   - Add state change comments

3. **Due Date Management**
   - Sync regular and deferred due dates
   - Handle timezone conversions
   - Update dates on state changes

### Phase 3: Webhook Integration
1. **Webhook Setup**
   - Create webhooks for each configured list
   - Implement webhook signature validation
   - Handle webhook health monitoring

2. **Event Processing**
   - Process task updates from ClickUp
   - Sync changes back to Sparkle
   - Handle bi-directional sync conflicts

### Phase 4: Advanced Features
1. **Custom Fields**
   - Create custom fields for Sparkle-specific data
   - Map inspection scores, responsibility groups
   - Store progress notes and plan to fix

2. **Reporting & Analytics**
   - Use ClickUp views for reporting
   - Create dashboards for property managers
   - Export data for compliance

## Rate Limits & Best Practices

### Rate Limiting
- Varies by workspace plan
- Free: 100 requests/minute
- Paid: Higher limits (check current plan)
- Use webhook events instead of polling

### Best Practices
1. **Batch Operations**
   - Use bulk endpoints where available
   - Minimize API calls with smart caching

2. **Error Handling**
   - Implement exponential backoff
   - Handle 429 rate limit errors
   - Log failed requests for retry

3. **Data Consistency**
   - Store ClickUp task IDs locally
   - Implement idempotent operations
   - Handle deleted tasks gracefully

4. **Performance**
   - Use webhooks for real-time updates
   - Cache frequently accessed data
   - Implement pagination for large datasets

## Migration Considerations

### From Trello to ClickUp
1. **Enhanced Features**
   - Custom fields (vs Trello's limited fields)
   - Better permission management
   - Built-in time tracking
   - Native dependencies

2. **Migration Path**
   - Export existing Trello data
   - Map Trello boards to ClickUp spaces
   - Convert cards to tasks with history
   - Preserve attachments and comments

3. **Parallel Operation**
   - Support both integrations temporarily
   - Gradual property migration
   - Fallback to Trello if needed

## Security Considerations

1. **Token Storage**
   - Encrypt API tokens at rest
   - Use environment variables
   - Implement token rotation

2. **Webhook Security**
   - Validate webhook signatures
   - Use HTTPS endpoints only
   - Implement request timeouts

3. **Access Control**
   - Respect ClickUp permissions
   - Implement property-level access
   - Audit API usage

## Error Codes & Handling

Common ClickUp API errors:
- `401`: Invalid/expired token
- `403`: Insufficient permissions
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Server error

Implement appropriate error handling and user feedback for each scenario.

## Resources

- [ClickUp API Documentation](https://developer.clickup.com)
- [API Reference](https://developer.clickup.com/reference)
- [Webhook Documentation](https://developer.clickup.com/docs/webhooks)
- [Authentication Guide](https://developer.clickup.com/docs/authentication)
- [Rate Limits](https://developer.clickup.com/docs/ratelimits)