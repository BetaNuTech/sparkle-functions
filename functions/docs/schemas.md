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

## Job

```typescript
interface Job {
  id?: string;
  title: string;
  need: string;
  authorizedRules: 'default' | 'expedite';
  scopeOfWork: string;
  trelloCardURL?: string;
  property: Firestore.DocumentReference; // https://googleapis.dev/nodejs/firestore/latest/DocumentReference.html
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  state: 'open' | 'approved' | 'authorized' | 'complete';
  type: 'improvement' | 'maintenance';
}
```

## Template

**TODO**
