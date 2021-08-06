const post = require('./api/post');
const postBid = require('./api/post-bid');
const put = require('./api/put');
const putBid = require('./api/put-bid');

module.exports = {
  api: {
    post,
    postBid,
    put,
    putBid,
  },
};
