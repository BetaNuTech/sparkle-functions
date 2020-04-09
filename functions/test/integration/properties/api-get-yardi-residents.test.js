const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const uuid = require('../../../test-helpers/uuid');
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
    const resident = createResident();
    const residentJsonApi = createResidentJsonApi(resident);
    const expected = {
      data: [residentJsonApi],
      included: [],
    };

    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createDoc({ code: 'test' }));
    sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
    sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
      residents: [resident],
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

  it('returns all discovered occupants & their relationships as JSON/API formatted records', done => {
    const occupantId1 = uuid();
    const occupantId2 = uuid();
    const resident = createResident('100', {
      occupants: [occupantId1, occupantId2],
    });
    const residentJsonApi = createResidentJsonApi(resident);
    const occupant1 = createOccupant(resident.id, occupantId1);
    const occupant1JsonApi = createIncludedOccupantJsonApi(occupant1);
    const occupant2 = createOccupant(resident.id, occupantId2);
    const occupant2JsonApi = createIncludedOccupantJsonApi(occupant2);
    const expected = {
      data: [residentJsonApi],
      included: [occupant1JsonApi, occupant2JsonApi],
    };

    // Stup requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createDoc({ code: 'test' }));
    sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
    sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
      residents: [resident],
      occupants: [occupant1, occupant2],
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

function createResident(id = '', config = {}) {
  const now = new Date().toISOString();
  return {
    id: id || uuid(),
    firstName: 'first',
    middleName: 'middle',
    lastName: 'last',
    email: 'test@email.com',
    mobileNumber: '12345678910',
    homeNumber: '12345678911',
    officeNumber: '12345678912',
    status: 'current resident',
    yardiStatus: 'current',
    leaseUnit: '1235',
    leaseSqFt: '123',
    leaseFrom: now,
    leaseTo: now,
    moveIn: now,
    occupants: [],
    ...config,
  };
}

function createOccupant(residentId, id = '', config = {}) {
  return {
    id: id || uuid(),
    resident: residentId, // relationship
    firstName: 'first',
    middleName: 'middle',
    lastName: 'last',
    email: 'test-occupant@email.com',
    mobileNumber: '12345678910',
    homeNumber: '12345678911',
    officeNumber: '12345678912',
    relationship: '',
    responsibleForLease: false,
    ...config,
  };
}

function createResidentJsonApi(resident) {
  const result = {
    id: resident.id,
    type: 'resident',
    attributes: { ...resident },
  };
  delete result.attributes.id;
  delete result.attributes.occupants;
  if (resident.occupants && resident.occupants.length) {
    result.relationships = {
      occupants: {
        data: resident.occupants.map(id => ({ id, type: 'occupant' })),
      },
    };
  }
  return result;
}

function createIncludedOccupantJsonApi(occupant) {
  const result = {
    id: occupant.id,
    type: 'occupant',
    attributes: { ...occupant },
  };

  delete result.attributes.id;
  delete result.attributes.resident;

  result.relationships = {
    resident: {
      data: { id: occupant.resident, type: 'resident' },
    },
  };

  return result;
}
