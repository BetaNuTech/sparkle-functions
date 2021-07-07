Clients make various HTTP requests to this appliction.  The API endpoints are defined throughout many of the functions modules, such as the `slack` module for managing OAuth2 with the Slack App.  The following are conventions for adding a new API endpoint.

## Architechture
- Should instantiated by factory functions:
```
module.exports = function myFactory(options) {
  return aysnc(req, res) => // ...
}
```
These factory functions are responsible for providing services and options to their instances.
- They're be simple [Express.js](https://expressjs.com/) endpoints.
- They live in an `api` directory within the module that defines it: (ie `properties/api`)
- They are exposed and accessed by their module under `api`:
```js
module.exports = {
  api: { createPDFReport }
}
```
- Filenames describe their HTTP method and purpose: ie `/properties/api/post.js` for creating properties.

## Conventions
- Do **not** instantiate new Express app instances to publish new endpoints, rather that should be left to the router.
- Import an api function's module into `./functions/router.js` and instantiate it there.
- Always add the `/v*` versioning path to an API endpoint to support multiple, backward incompatible, API responses.
