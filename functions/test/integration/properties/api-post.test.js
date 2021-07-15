const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const propertiesModel = require('../../../models/properties');
const post = require('../../../properties/api/post');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');

describe('Properties | API | POST', () => {
  // TODO reenable when user's can configure property from request payload
  // it('rejects request with invalid property payload', done => {
  //   request(createApp())
  //     .post('/t')
  //     .send({ name: '' }) // falsey name is invalid
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.contain('unexpected error');
  //       done();
  //     })
  //     .catch(done);
  // });

  it('returns the property JSON API document on successfull creation', done => {
    const expected = {
      data: {
        type: 'property',
        attributes: { name: 'Not Set', templates: {} },
      },
    };
    const propertyId = uuid();
    const property = mocking.createProperty({
      name: 'Not Set',
      templates: {},
    });

    sinon
      .stub(propertiesModel, 'firestoreCreateRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    request(createApp())
      .post(`/t`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.post('/t/', bodyParser.json(), stubAuth, post({ collection: () => {} }));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
