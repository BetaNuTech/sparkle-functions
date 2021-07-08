Watcher functions respond to [event triggers in Firebase database](https://firebase.google.com/docs/functions/database-events).

## Architechture
- Watchers should be instantiated via factory functions:
```
module.exports = function myFactory(options) {
  return aysnc(change, event) => // ...
}
```
These factory functions are responsible for providing services and options to watcher instances.

- Watchers should live in a module's `watchers` directory (ie `teams/watchers/on-team-create.js`)
- Watchers should be exported from a module under the `watchers` attribute:
In the teams module `/teams/index.js`
```js
module.exports = {
  watchers: {
    onTeamCreate
  }
};
```
- Watchers should describe the database event's they're responding too: `teams/watchers/on-team-create.js`

## Conventions
- Watchers should generally be avoided in favor of API endpoints if at all possible
- On write watchers are more complex and less performant so should be avoided in favor of `onDelete` or `onUpdate` watchers.
