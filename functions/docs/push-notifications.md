# Push notifications

How Sparkle sends push notifications, what triggers them, and what clients must do to receive them.

## Pipeline

1. Something writes a `notifications/{id}` Firestore document with a `title`, a `summary` and optionally a `creator` and a `property`. That can be the API (table A below), or the iOS and web clients writing to Firestore directly (table B).
2. The `createNotification` onCreate watcher (`notifications/on-create-v2.js`) builds the Slack message and, through `notifications/utils/create-push-v2.js`, the push recipients:
   - It loads every user, then drops the `creator` and anyone with `pushOptOut: true`.
   - **With a `property`**, recipients are admins, corporate users who are not team leads, users with that property, and team leads of that property (`get-push-recepients.js`).
   - **Without a `property`**, recipients are admins only.
   - It writes `push.{uid} = { title, message, createdAt }` and `unpublishedPush = N`, then publishes the notification ID to the `push-messages-sync` topic.
   - With no recipients it marks `publishedMediums.push = true` straight away.
3. `publishPushNotificationsV2` (`notifications/pubsub/publish-push-v2.js`) handles each user in `push`:
   - It re-reads the user's record and skips users who have since set `pushOptOut` or been deleted.
   - It reads the user's tokens from Firestore `registrationTokens/{uid}`.
   - It sends one FCM HTTP v1 message per token (`notifications/utils/publish-push-message.js`).
   - It removes tokens that FCM reports as unregistered or malformed.
   - A user's message is done once any device accepted it, every token was dead, the user has no tokens, or the user opted out.
   - If every send failed for another reason (for example FCM being unavailable), the message stays and is retried, until it is 24 hours old.
4. App Engine cron (`appengine/cron.yaml`):
   - **Hourly `push-messages-sync`:** retries every notification with `unpublishedPush > 0`.
   - **Hourly `notifications-sync`:** deletes notifications published to both Slack and push. The cron description calls this "slack", but the job is cleanup.
   - **Weekly `registration-tokens-sync`:** deletes tokens whose timestamp is more than a month old.

## Registration tokens

Firestore is the canonical store:

```
registrationTokens/{firebaseAuthUid}
  {fcmRegistrationToken}: {unix seconds the device last registered it}
```

- Write the token on every launch and on every token refresh, while signed in. Use a merge write such as `setData([token: Int(Date().timeIntervalSince1970)], merge: true)`, so the device's other tokens are kept.
- Tokens not refreshed for a month are removed by the weekly job.
- The current Firestore rules let any member write this document. Members are signed-in users who have a `users/{uid}` doc.

The released iOS app still writes the same shape to the **Realtime Database** at `/registrationTokens/{uid}`. The `regTokensRealtimeMirror` watcher (`reg-tokens/watchers/on-write-realtime.js`) copies added or refreshed tokens from there into Firestore. Remove the watcher once every supported iOS build writes to Firestore.

## Message payload

Each message is sent with the FCM HTTP v1 API (`messaging.send`):

```js
{
  token,
  notification: { title, body },            // body = notification summary
  data: { notificationId, propertyId? },    // strings; propertyId only for property notifications
  apns: {
    headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
    payload: { aps: { sound: 'default' } },
  },
  webpush: { notification: { icon } },
}
```

On iOS, `notificationId` and `propertyId` arrive as top-level keys in `userInfo`, next to `aps` and `gcm.message_id`.

## Inventory

### A. Created by the backend

Unless noted, each is skipped when the request sets `incognitoMode`. Templates live in `utils/src-notification-templates.js`.

| # | Source | Trigger | Gate | Title | Summary | Property-scoped | Creator excluded |
|---|---|---|---|---|---|---|---|
| 1 | `deficient-items/api/put-batch.js` | `PUT /v0/deficiencies` | `?notify=true` (web sends it, iOS does not). One per updated item | property name, or "Unknown Property" | `Deficient Item: {title} moved from {previous} to {state} by {author}`, or `... updated by {author}` | yes | yes |
| 1b | same | same | also `config.notifications.enabled.deficientItemProgressNote`, which is **off**, so this never fires | property name | `Progress Note just added to Deficient Item ...` | yes | yes |
| 2 | `deficient-items/pubsub/sync-overdue-v2.js` | hourly `deficient-items-sync` | item becomes overdue or requires a progress update | property name | `... moved from X to overdue by Sparkle` | yes | n/a (no creator) |
| 3 | `inspections/api/patch-property.js` | `PATCH /v0/inspections/:id` | admin | destination property name | `{date} inspection moved by {author}` | yes | yes |
| 4 | `inspections/api/patch-template.js` | `PATCH /v0/inspections/:id/template` | inspection completed | property name | `{date} inspection completed by {author} ({email}), using {template} template` | yes | yes |
| 5 | `inspections/report-pdf/index.js` | `complete-inspection-update` topic, after report PDF generation | an author with a name is known | property name | `{date} inspection report created/updated by ...` | yes | yes |
| 6 | `properties/api/post.js` | `POST /v0/properties` | | Property Creation | ` created by {author}` (name not passed) | yes | yes |
| 7 | `properties/api/put.js` | `PUT /v0/properties/:id` | | Property Update | ` updated by {author}` | intended, but passes `property.id` from the document data, which is likely `undefined`. That would make the write fail and no notification be created | yes |
| 8 | `slack/api/post-auth.js` | `POST /v0/integrations/slack/authorization` | | Slack App Addition | `The Sparkle Slack App added to team ...` | no | yes |
| 9 | `slack/api/patch-auth.js` | `PATCH /v0/integrations/slack/authorization` | | Slack App Update | `System Channel updated to ...` | no | yes |
| 10 | `teams/api/post.js` | `POST /v0/teams` | | Team Creation | ` created by {author}` | no | yes |
| 11 | `teams/api/patch.js` | `PATCH /v0/teams/:id` | | Team Update | ` updated to  by {author}` | no | yes |
| 12 | `teams/api/delete.js` | `DELETE /v0/teams/:id` | | Team Deletion | `The team {name} deleted by ...` | no | yes |
| 13 | `template-categories/api/post.js` | `POST /v0/template-categories` | | Template Category Creation | `{name} created` | no | yes |
| 14 | `template-categories/api/patch.js` | `PATCH /v0/template-categories/:id` | | Template Category Update | `{previous} updated to {name} by ...` | no | yes |
| 15 | `template-categories/api/delete.js` | `DELETE /v0/template-categories/:id` | | Template Deletion (mislabelled) | `{name} deleted by ...` | no | yes |
| 16 | `templates/api/patch.js` | `PATCH /v0/templates/:id` | template becomes complete | Template Creation | `{name} created by ...` | no | yes |
| 17 | same | same | template already complete | Template Update | `{name} updated by ...` | no | **no**: sets no creator |
| 18 | `templates/api/delete.js` | `DELETE /v0/templates/:id` | | Template Deletion | `{name} deleted by ...` | no | yes |
| 19 | `trello/api/post-auth.js` | `POST /v0/integrations/trello/authorization` | | Trello Integration Added | `The trello account ... added by ...` | no | yes |
| 20 | `trello/api/put-property-integration.js` | `PUT /v0/integrations/trello/properties/:id` | | Trello Settings Change for Property | `Trello Settings updated by ...` | yes | yes |
| 21 | `trello/api/delete-property-integration.js` | `DELETE /v0/integrations/trello/properties/:id` | | same as #20 | same | yes | yes |
| 22 | `trello/api/post-deficiency-card.js` | `POST /v0/deficiencies/:id/trello/card` | `?notify=true` (web only) | property name | `Trello card created for Deficient Item: ...` | yes | yes |
| 23 | `users/api/patch.js` | `PATCH /v0/users/:id` | user disabled | User Disabled | `The account for {email} disabled by ...` | no | yes |
| 24 | same | same | any other update, **including a user changing their own `pushOptOut`** | User Update | `The account for {email} was just updated by by ...` | no | yes |

### B. Written directly to Firestore by clients

The `createNotification` watcher handles these the same way. Both clients set `creator` to the signed-in user and prefix the title with `[STAGING] ` outside production.

- **iOS** (`Classes/Notifications.swift`): team, property, template and template category creation, update and deletion, all admin-only. Job and bid deletion, also admin-only. Property-scoped: inspection completed, inspection deleted, deficient item state change, Trello card created and Trello settings updated.
- **Web** (`common/services/firestore/notifications.ts`): Property Deletion, and Inspection Deletion. Inspection Deletion carries no `property`, so it goes to admins only, unlike the iOS version.

### Opt-out

`pushOptOut` is applied when recipients are chosen (`create-push-v2.js`) and again at send time (`publish-push-v2.js`). Every push goes through these two steps.
