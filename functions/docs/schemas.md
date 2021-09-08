## Property

```typescript
interface property {
  id?: string;
  name: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  code?: string;
  lastInspectionDate?: number;
  lastInspectionScore?: number;
  loan_type?: string;
  maint_super_name?: string;
  manager_name?: string;
  num_of_units?: number;
  numOfInspections?: number;
  bannerPhotoName?: string;
  bannerPhotoURL?: string;
  logoName?: string;
  logoURL?: string;
  photoName?: string;
  photoURL?: string;
  state?: string;
  year_built?: number;
  slackChannel?: string;
  zip?: string;

  // Relationships
  templates: {};
  team?: string;

  // Deficient Item Attributes
  numOfDeficientItems?: number;
  numOfRequiredActionsForDeficientItems?: number;
  numOfFollowUpActionsForDeficientItems?: number;
  numOfOverdueDeficientItems?: number;
}
```

## Inspection

```typescript
interface inspection {
  id?: string;
  updatedAt: number; // UNIX timestamp (default to now)
  creationDate: number; // UNIX timestamp (default to now)
  completionDate?: number; // UNIX timestamp
  deficienciesExist: boolean;
  inspectionCompleted: boolean;
  inspectorName: string;
  itemsCompleted: number; // default 0
  inspectionReportFilename?: string;
  inspectionReportURL?: string;
  score?: number;
  templateName: string;

  // Report (PDF) attributes
  inspectionReportStatus?: string;
  inspectionReportUpdateLastDate: number; // UNIX timestamp

  // Relationships
  templateId: string; // template ID
  templateCategory: string; // templateCategory ID
  property: string; // property ID
  inspector: string;

  // Embedded copy of template
  template: template;
}
```

## Template

```typescript
interface Template {
  id?: string;
  name: string;
  description: string;
  category: string; // template category relationship
  trackDeficientItems: boolean;
  properties?: Array<string>;
  sections?: any;
  items?: any;
}
```

## Template Category

```typescript
interface templateCategory {
  id: string;
  name: string;
}
```

## Inspection/Template Item

```typescript
interface InspectionItem {
  adminEdits?: any;
  deficient: boolean;
  index: number;
  isItemNA: boolean;
  isTextInputItem: boolean;
  mainInputFourValue: number;
  mainInputNotes: string;
  mainInputOneValue: number;
  mainInputSelected: boolean;
  mainInputSelection: number;
  mainInputThreeValue: number;
  mainInputTwoValue: number;
  itemType: string;
  mainInputType: string;
  mainInputZeroValue: number;
  notes: boolean;
  photos: boolean;
  sectionId: string;
  title: string;
  signatureDownloadURL: string;
  signatureTimestampKey: string;
  version: number;
}
```

## Inspection/Template Section

```typescript
interface InspectionSection {
  index: number;
  title: string;
  added_multi_section: boolean;
  section_type: string;
}
```

## Team

```typescript
interface team {
  id?: string;
  name: string;
  properties?: any;
}
```

## User
```typescript
interface user {
  id: string;
  admin: boolean;
  corporate: boolean;
  email: string;
  firstName: string;
  lastName: string;
  pushOptOut: boolean;
  properties?: any;

  /**
   * Property level access granted via team associations
   * NOTE: property associations w/ teams are nested under
   *       their team ID: `{ teamId: { propertyId: true } }`
   */
  teams?: any;

  // UNIX timestame of creation date
  createdAt: number;

  // UNIX timestamp of last login
  lastSignInDate?: number;

  // User agent string of last sign up OS/Browser
  lastUserAgent?: string;
}
```

## Notification

```typescript
interface notification {
  title: string;
  summary: string;
  creator?: string; // user id
  property?: string; // property id
  markdownBody?: string;
  userAgent?: string;
}
```

## Job

```typescript
interface Job {
  id?: string;
  title: string;
  need: string;
  authorizedRules?: 'default' | 'expedite';
  scopeOfWorkAttachment?: any; // Reference of attachment id
  scopeOfWork?: string;
  trelloCardURL?: string;
  property: string;
  createdAt?: number;
  updatedAt?: number;
  state?: 'open' | 'approved' | 'authorized' | 'complete';
  type: 'asset management project' | 'property management project' | 'hybrid capital project';
}
```

## Bid

```typescript
interface bid {
  id?: string;
  attachments: Array<bidAttachmentModel>;
  completeAt?: number; // Unix timestamp
  costMax: number;
  costMin: number;
  createdAt: number; // Unix timestamp
  job: string;
  startAt?: number; // Unix timestamp
  state: 'open' | 'approved' | 'rejected' | 'incomplete' | 'complete';
  updatedAt: number; // Unix timestamp
  vendor: string;
  vendorDetails?: string;
  scope: 'local' | 'national';
}
```


