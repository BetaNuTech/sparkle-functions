const uuid = require('./uuid');

module.exports = {
  createFirestore() {
    return {
      collection: () => {},
      batch: () => ({
        commit: () => Promise.resolve(),
      }),
    };
  },

  createSnapshot(id = uuid(), data = null) {
    return {
      exists: Boolean(data),
      id,
      data: () => data,
    };
  },

  createCollection(...docs) {
    return {
      docs,
      size: docs.length,
    };
  },

  createPubSub(cb = () => {}) {
    return {
      topic: () => ({
        publisher: () => ({
          publish: (...args) => {
            cb(...args);
            return Promise.resolve();
          },
        }),
      }),
    };
  },

  createPubSubHandler(msg) {
    return {
      topic: () => ({
        onPublish: handler => handler(msg),
      }),
    };
  },

  createMessagingStub(cb = () => {}) {
    return {
      sendToDevice(...args) {
        const result = cb(...args);
        return result || Promise.resolve({ multicastId: uuid() });
      },
    };
  },
};
