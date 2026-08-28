# auth-gate

A Firebase Auth `beforeUserCreated` blocking function that refuses to create an
account for any email address without a matching record in the `users`
collection.

## Status: written and tested, NOT deployed

Sparkle keeps Google sign-in from creating accounts a simpler way: **Firebase
console → Authentication → Settings → User actions → "Enable create (sign-up)"
is unchecked.** That refuses account creation for every provider at the
Identity Platform layer, and the Admin SDK is exempt, so `POST /v0/users` still
works. The client sees `auth/admin-restricted-operation`, which the web app
maps to the refusal copy in `common/services/auth.ts`.

That setting is preferred over this function because it cannot fail open. A
blocking function that times out or errors is a decision point that can go the
wrong way; a disabled sign-up permission is not.

This codebase is deliberately **not** registered in `firebase.json`, so
`firebase deploy --only functions` will not pick it up.

## When you might want it

Deploy this if the gate ever needs per-address logic rather than a blanket
refusal -- allowing a specific domain, richer refusal messages, or an audit
trail of refused attempts.

To enable it:

1. Upgrade the project to Firebase Authentication with Identity Platform
   (required for blocking functions).
2. Add it back to `firebase.json`:
   ```json
   "functions": [
     { "source": "functions", "codebase": "default" },
     { "source": "auth-gate", "codebase": "auth-gate" }
   ]
   ```
3. `firebase use <project>` -- note `.firebaserc` defaults to **production**.
4. `firebase deploy --only functions:auth-gate`

Needs firebase-tools 12+ for v2 functions. Deploying registers it with Firebase
Auth automatically; there is no separate console step.

Note that re-checking "Enable create (sign-up)" is required for this function to
be reached at all -- with sign-up disabled, Identity Platform refuses before any
blocking function runs.

## Tests

```bash
npm install && npm test
```
