# Trello Integration Analysis - Sparkle Functions

## Overview

Trello is deeply integrated into the Sparkle Functions application as a project management and issue tracking system. The integration allows properties to track deficiencies (deficient items) and jobs through Trello cards, providing seamless synchronization between Sparkle and Trello boards.

## Purpose and Use Cases

### 1. **Deficient Item Tracking**
- When deficiencies are identified during property inspections, they can be exported to Trello cards
- Cards automatically sync status changes, due dates, and progress notes between Sparkle and Trello
- Property managers can track remediation progress in their preferred Trello workflow

### 2. **Job Management**
- Jobs (work orders) can be exported to Trello for vendor/contractor management
- Includes bid tracking and completion timelines
- Syncs job status and due dates with Trello cards

## API Endpoints

### Authentication & Setup

#### `POST /v0/integrations/trello/authorization`
- **Auth**: Admin only
- **Purpose**: Store Trello API credentials (API key and auth token)
- **Features**: 
  - Validates credentials with Trello API
  - Stores member ID and user details
  - Creates global notification of integration

#### `DELETE /v0/integrations/trello/authorization`
- **Auth**: Admin only  
- **Purpose**: Remove all Trello credentials and property integrations
- **Features**: Batch deletes all Trello data from system

### Board Management

#### `GET /v0/integrations/trello/boards`
- **Auth**: Admin + Trello Auth
- **Purpose**: Fetch all Trello boards accessible by authenticated user
- **Features**: Returns boards with their associated organizations

#### `GET /v0/integrations/trello/boards/:boardId/lists`
- **Auth**: Admin + Trello Auth
- **Purpose**: Get all lists within a specific Trello board
- **Features**: Used for property configuration setup

### Property Integration

#### `PUT /v0/integrations/trello/properties/:propertyId`
- **Auth**: Admin + Trello Auth
- **Purpose**: Configure Trello integration for a specific property
- **Payload**: 
  ```javascript
  {
    openBoard: "boardId",        // Board for new/active items
    openBoardName: "Board Name",
    openList: "listId",         // List for new cards
    openListName: "List Name",
    closedBoard: "boardId",     // Board for completed items
    closedBoardName: "Board Name", 
    closedList: "listId",       // List for closed cards
    closedListName: "List Name"
  }
  ```

#### `DELETE /v0/integrations/trello/properties/:propertyId`
- **Auth**: Admin + Trello Auth
- **Purpose**: Remove Trello integration from a property

### Card Creation

#### `POST /v0/deficiencies/:deficiencyId/trello/card`
- **Auth**: Multi-Role + Deficiency Auth + Trello Auth
- **Purpose**: Create a Trello card for a deficient item
- **Features**:
  - Creates card with deficiency details (score, notes, plan to fix)
  - Attaches inspection item photos
  - Sets due dates from deficiency timeline
  - Adds Trello member from integration
  - Stores card ID for future syncing

#### `POST /v0/properties/:propertyId/jobs/:jobId/trello`
- **Auth**: Multi-Role + Trello Auth
- **Purpose**: Create a Trello card for a job
- **Features**:
  - Includes job title and property info
  - Sets due date from approved bid completion date
  - Links back to Sparkle job URL

## Background Services (Pub/Sub)

### `deficiencyTrelloCardStateComments`
- **Topic**: `deficient-item-status-update`
- **Purpose**: Add comments to Trello cards when deficiency state changes
- **Features**:
  - Uses configurable comment templates for each state transition
  - Includes user info, dates, and relevant deficiency data
  - Examples: "PENDING to OVERDUE", "COMPLETED to CLOSED"

### `deficiencyTrelloCardDueDates`
- **Topic**: `deficient-item-status-update`
- **Purpose**: Update Trello card due dates when deficiency dates change
- **Features**:
  - Syncs regular due dates and deferred dates
  - Removes due dates when items go to "go-back" state
  - Handles timezone conversion based on property location

### `deficiencyTrelloCardClose`
- **Topic**: `deficient-item-status-update`
- **Purpose**: Move cards to closed list and mark as complete
- **Features**:
  - Triggers on "closed" or "completed" states
  - Moves card to configured closed list if available
  - Marks due date as complete

## Data Models

### System Collection
- **Document**: `system/trello`
  - Stores private API credentials
  - Fields: `apikey`, `authToken`, `user`, `member`

- **Document**: `system/trello-{propertyId}`
  - Maps Trello card IDs to deficiency/job IDs
  - Structure: `{ cards: { [cardId]: deficiencyId } }`

### Integrations Collection
- **Document**: `integrations/trello`
  - Public Trello organization details
  - Fields: `member`, `trelloUsername`, `trelloEmail`, `trelloFullName`

- **Document**: `integrations/trello-{propertyId}`
  - Property-specific Trello configuration
  - Contains board and list mappings

### Deficiencies Collection
- **Field**: `trelloCardURL`
  - Stores the short URL to the Trello card
  - Added when card is created

### Jobs Collection  
- **Field**: `trelloCardURL`
  - Stores the short URL to the Trello card
  - Added when card is created

## Configuration

### Deficient Items (`config/deficient-items.js`)
- **Card Description Template**: Handlebars template for card content
- **Comment Templates**: State transition comment templates
- Supports variables like:
  - `{{{firstName}}}`, `{{{lastName}}}`, `{{{email}}}`
  - `{{{currentDueDateDay}}}`, `{{{currentResponsibilityGroup}}}`
  - `{{{currentPlanToFix}}}`, `{{{currentProgressNote}}}`

### Jobs (`config/jobs.js`)
- **Card Description Template**: Simpler template for job cards
- Includes property name, job title, and Sparkle URL

## Service Layer (`services/trello.js`)

Provides low-level Trello API integration:
- `fetchToken()` - Validate auth token
- `fetchMemberRecord()` - Get user details
- `fetchAllBoards()` - List user's boards
- `fetchAllOrganizations()` - Get user's organizations
- `fetchBoardLists()` - Get lists in a board
- `publishListCard()` - Create a new card
- `publishCardAttachment()` - Add image to card
- `publishTrelloCardComment()` - Add comment to card
- `updateTrelloCard()` - Update card properties
- `archiveTrelloCard()` - Archive/unarchive card

## Authentication Flow

1. Admin provides Trello API key and auth token
2. System validates credentials and fetches member info
3. Credentials stored encrypted in Firestore
4. `auth-trello-request.js` middleware validates access
5. All subsequent API calls use stored credentials

## Error Handling

- **Deleted Cards**: Special handling for 404 errors
  - Cleans up references in system collection
  - Uses error code `ERR_TRELLO_CARD_DELETED`
  
- **Missing Integration**: Returns 409 Conflict
- **Invalid Credentials**: Returns 401 Unauthorized

## Security Considerations

- Only admins can configure Trello integration
- Trello credentials stored separately from public config
- Property-level access control for card creation
- No direct webhook integration (uses Pub/Sub instead)

## Key Features

1. **Automatic Syncing**: State changes, due dates, and progress notes sync automatically
2. **Photo Attachments**: Inspection photos attached to cards
3. **Configurable Workflows**: Each property can have different boards/lists
4. **State Comments**: Detailed transition history added as card comments
5. **Timezone Support**: Due dates respect property timezone
6. **Bulk Operations**: Batch processing for performance

## Limitations

- No bi-directional sync (Trello changes don't update Sparkle)
- No webhook support (polling would be required)
- Cards can only be created, not deleted programmatically
- One Trello account per Sparkle organization