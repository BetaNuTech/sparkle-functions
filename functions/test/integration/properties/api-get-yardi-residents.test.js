const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const propertiesModel = require('../../../models/properties');
const yardi = require('../../../services/yardi');
const getPropertyResidents = require('../../../properties/api/get-property-yardi-residents');

describe("Properties | API | GET Property's Yardi Residents", () => {
  afterEach(() => sinon.restore());

  it('rejects request to non-existent property', done => {
    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createEmptyDoc());

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
    sinon.stub(propertiesModel, 'firestoreFindRecord').resolves(createDoc({}));

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

  it('rejects when yardi credentials not set for organization', done => {
    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createDoc({ code: 'test' }));
    sinon.stub(systemModel, 'findYardiCredentials').resolves(createEmptySnap());

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Organization not configured for Yardi'
        );
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when Yardi request fails', done => {
    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createDoc({ code: 'test' }));
    sinon.stub(systemModel, 'findYardiCredentials').resolves(
      createSnap({
        userName: 'yardi',
        password: 'yardi',
        serverName: 'test',
        database: 'test_db',
        entity: 'sparkle',
        license: 'abc-123',
      })
    );
    sinon
      .stub(yardi, 'getYardiPropertyResidents')
      .rejects(Error('request timeout'));

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(500)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Unexpected error fetching residents'
        );
        done();
      })
      .catch(done);
  });

  it('returns all discovered residents as JSON/API formatted records', done => {
    const resident = {
      id: '100',
      type: 'resident',
      attributes: {
        firstName: 'test',
        middleName: 'this',
        lastName: 'user',
        email: 'test@gmail.com',
        mobileNumber: '15126657412',
        officeNumber: '',
        homeNumber: '',
        status: 'current resident',
        yardiStatus: 'current',
        leaseUnit: '1926',
        leaseSqFt: '910',
        leaseFrom: '2020-01-01T00:00:00',
        leaseTo: '2020-12-31T00:00:00',
        moveIn: '2019-02-27T00:00:00',
      },
    };
    const expected = {
      data: [resident],
      included: [],
    };

    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createDoc({ code: 'test' }));
    sinon.stub(systemModel, 'findYardiCredentials').resolves(
      createSnap({
        userName: 'yardi',
        password: 'yardi',
        serverName: 'test',
        database: 'test_db',
        entity: 'sparkle',
        license: 'abc-123',
      })
    );
    sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
      residents: [
        {
          id: resident.id,
          occupants: [],
          ...resident.attributes,
        },
      ],
      occupants: [],
    });

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get('/t/:propertyId', stubAuth, getPropertyResidents({}, {}));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function createEmptyDoc() {
  return { data: () => null, exists: false };
}

function createEmptySnap() {
  return { val: () => null, exists: () => false };
}

function createDoc(data = {}) {
  return { data: () => data, exists: true };
}

function createSnap(data = {}) {
  return { val: () => data, exists: () => true };
}
