const { expect } = require("chai");
const templateCategories = require("./index");

const { onDeleteHandler } = templateCategories;
const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe("Template Categories", function() {
  describe("On deletion", function() {
    it("should lookup all templates associated with template category", function() {
      const expected = uuid();
      const templateCategory = createDataSnapshot({}, expected);
      const db = createDatabase();
      db.equalTo = actual => {
        expect(actual).to.equal(expected, 'looked up templates by snapshop ID');
        return db;
      };
      return onDeleteHandler(db)(templateCategory, { params: { objectId: expected } });
    });

    it("should apply all updates to the database", function() {
      const template1 = createDataSnapshot().val();
      const template2 = createDataSnapshot().val();
      const payload = Object.assign({}, template1, template2);
      const [template1Id] = Object.keys(template1);
      const [template2Id] = Object.keys(template2);
      const id = uuid();
      const db = createDatabase(payload, id);
      db.update = updates => {
        const actual = Object.keys(updates);
        expect(actual).to.have.lengthOf(2, 'has 2 updates');
        expect(actual).to.include(`/templates/${template1Id}/category`, 'has template 1 update');
        expect(actual).to.include(`/templates/${template2Id}/category`, 'has template 2 update');
        return Promise.resolve();
      };
      return onDeleteHandler(db)(createDataSnapshot(), { params: { objectId: id } });
    });
  });
});

function createDatabase(payload = {}) {
  return {
    ref() {
      return this;
    },
    update() {
      return Promise.resolve();
    },
    orderByChild() {
      return this;
    },
    equalTo() {
      return this;
    },
    once() {
      return Promise.resolve({
        val: () => payload,
        exists: () => true
      });
    }
  };
}

function createDataSnapshot(config = {}, id = uuid()) {
  return {
    _path: `/category/${id}`,
    val: () => ({ [id]: Object.assign({}, config) }),
  };
}
