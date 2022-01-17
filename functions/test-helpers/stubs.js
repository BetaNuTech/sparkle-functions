const uuid = require('./uuid');

module.exports = {
  createFirestore(firestoreConfig = {}) {
    return {
      collection: () => {},
      batch: () => ({
        commit: () => Promise.resolve(),
      }),
      ...firestoreConfig,
    };
  },

  /**
   * Create a snapshot of a
   * payload or a group of payloads
   * @param  {Object|Array} payload
   * @param  {String} id
   * @return {Object} - snapshot lookalike
   */
  wrapSnapshot(payload = {}, id) {
    const forEach = fn => {
      return Object.keys(payload).forEach(plId =>
        fn(this.wrapSnapshot(payload[plId], plId))
      );
    };

    let result = {};

    if (Array.isArray(payload)) {
      const docs = payload.map(pl => this.wrapSnapshot(pl, pl.id));
      result = this.createCollection(...docs);
      result.forEach = forEach;
    } else {
      result = this.createSnapshot(id, payload);
    }

    return result;
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

  createStorage(cb = () => {}) {
    return {
      bucket: (...args) => {
        cb(...args);
        return Promise.resolve();
      },
    };
  },
};
