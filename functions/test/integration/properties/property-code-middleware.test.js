const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const propertiesModel = require('../../../models/properties');
const propertyCode = require('../../../properties/middleware/property-code');

describe('Properties | Middleware | Property Code', () => {
  afterEach(() => sinon.restore());

  it('rejects request to non-existent property', done => {
    // Stup requests
    sinon.stub(propertiesModel, 'findRecord').resolves(createEmptyDoc());

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(404)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('property does not exist');
        done();
      })
      .catch(done);
  });

  it('rejects when property is missing a yardi code', done => {
    // Stup requests
    sinon.stub(propertiesModel, 'findRecord').resolves(createDoc({}));

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('code not set for Yardi');
        done();
      })
      .catch(done);
  });

  it('continues pipeline when property exists with a usable code', done => {
    // Stup requests
    sinon.stub(propertiesModel, 'findRecord').resolves(
      createDoc({
        code: 'test',
      })
    );

    request(createApp())
      .get('/t/123')
      .send()
      .expect(200)
      .then(() => done())
      .catch(() => done());
  });
});

function createApp() {
  const app = express();
  app.get('/t/:propertyId', propertyCode({}), (_, res) =>
    res.status(200).send()
  );
  return app;
}

function createDoc(data = {}) {
  return { data: () => data, exists: true };
}

function createEmptyDoc() {
  return { data: () => null, exists: false };
}
