## Create New Job

`POST /api/v0/properties/:propertyId/jobs`

###### Payload:

```js
{
  "title": "required",
  "need": "optional",
  "scopeOfWork": "optional",
  "property": "property-id", // required
  "type": "improvement" // required (Enum value)
}
```

**Permissions:** admins, corporates, & property-level

## Update A Job

`PUT /api/v0/properties/:propertyId/jobs/:jobId`

###### Payload:

```js
{
  "state": "approved",  // optional (Enum value)
  "title": "optional",
  "need": "optional",
  "scopeOfWork": "optional",
  "authorizedRules": "expedite", // optional* (Enum value) (admins only)
  "type": "improvement" // optional (Enum value)
}
```

**Permissions:** admins, corporates, & property-level

###### Special Privileges

- Only admins can request to set `authorizedRules` to `expedite`

## Create New Bid

`POST /api/v0/properties/:propertyId/jobs/:jobId/bids`

###### Payload:

```js
{
  "vendor": "required",
  "vendorDetails": "optional",
  "costMin": 100, // optional
  "costMax": 101, // optional
  "startAt": 123, // optional UNIX timestamp
  "completeAt": 456 // optional UNIX timestamp
}
```

**Permissions:** admins, corporates, & property-level

## Update a Bid

`PUT /api/v0/properties/:propertyId/jobs/:jobId/bids/:bidId`

###### Payload:

```js
{
  "state": "approved", // optional
  "vendor": "updated", // optional
  "vendorDetails": "optional",
  "costMin": 100, // optional
  "costMax": 101, // optional
  "startAt": 123, // optional UNIX timestamp
  "completeAt": 456 // optional UNIX timestamp
}
```

**Permissions:** admins, corporates, & property-level
**Note:** Some state transitions require attributes be/were set
