// const request = require('supertest');
// const { expect } = require('chai');
// const sinon = require('sinon');
// const express = require('express');
// const uuid = require('../../../test-helpers/uuid');
// const systemModel = require('../../../models/system');
// const yardi = require('../../../services/yardi');
// const cobalt = require('../../../services/cobalt');
// const getPropertyWorkOrders = require('../../../properties/api/get-property-yardi-work-orders');

// describe("Properties | API | GET Property's Yardi Work Orders", () => {
//   afterEach(() => sinon.restore());

  // it('rejects when yardi credentials not set for organization', done => {
  //   // Stup requests
  //   const property = { code: 'test' };
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createEmptySnap());
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(403)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.contain(
  //         'Organization not configured for Yardi'
  //       );
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns a helpful error when Yardi request fails', done => {
  //   // Stup requests
  //   const property = { code: 'test' };
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(cobalt, 'getPropertyTenants').rejects(Error('ignore'));
  //   sinon
  //     .stub(yardi, 'getYardiPropertyResidents')
  //     .rejects(Error('request timeout'));
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.contain(
  //         'Unexpected error fetching residents'
  //       );
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns a helpful error when Yardi rejected property code', done => {
  //   const property = { code: 'test' };
  //   const invalidCodeErr = Error('bad code');
  //   invalidCodeErr.code = 'ERR_NO_YARDI_PROPERTY';
  //
  //   // Stup requests
  //   sinon.stub(cobalt, 'getPropertyTenants').rejects(Error('ignore'));
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(yardi, 'getYardiPropertyResidents').rejects(invalidCodeErr);
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(404)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.contain('yardi code for property');
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns a helpful error when Yardi credentials rejected', done => {
  //   const property = { code: 'test' };
  //   const invalidCodeErr = Error('bad credentials');
  //   invalidCodeErr.code = 'ERR_BAD_YARDI_CREDENTIALS';
  //
  //   // Stup requests
  //   sinon.stub(cobalt, 'getPropertyTenants').rejects(Error('ignore'));
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(yardi, 'getYardiPropertyResidents').rejects(invalidCodeErr);
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(401)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.contain(
  //         'credentials not accepted'
  //       );
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns all discovered residents as JSON/API formatted records', done => {
  //   const property = { code: 'test' };
  //   const resident = createResident();
  //   const residentJsonApi = createResidentJsonApi(resident);
  //   const expected = {
  //     meta: {},
  //     data: [residentJsonApi],
  //     included: [],
  //   };
  //
  //   // Stup requests
  //   sinon.stub(cobalt, 'getPropertyTenants').rejects(Error('ignore'));
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
  //     residents: [resident],
  //     occupants: [],
  //   });
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(200)
  //     .then(res => {
  //       expect(res.body).to.deep.equal(expected);
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns all discovered occupants & their relationships as JSON/API formatted records', done => {
  //   const property = { code: 'test' };
  //   const occupantId1 = uuid();
  //   const occupantId2 = uuid();
  //   const resident = createResident('100', {
  //     occupants: [occupantId1, occupantId2],
  //   });
  //   const residentJsonApi = createResidentJsonApi(resident);
  //   const occupant1 = createOccupant(resident.id, occupantId1);
  //   const occupant1JsonApi = createIncludedOccupantJsonApi(occupant1);
  //   const occupant2 = createOccupant(resident.id, occupantId2);
  //   const occupant2JsonApi = createIncludedOccupantJsonApi(occupant2);
  //   const expected = {
  //     meta: {},
  //     data: [residentJsonApi],
  //     included: [occupant1JsonApi, occupant2JsonApi],
  //   };
  //
  //   // Stup requests
  //   sinon.stub(cobalt, 'getPropertyTenants').rejects(Error('ignore'));
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
  //     residents: [resident],
  //     occupants: [occupant1, occupant2],
  //   });
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(200)
  //     .then(res => {
  //       expect(res.body).to.deep.equal(expected);
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('layers on any successfully discovered Cobalt data to JSON/API formatted residents', done => {
  //   const property = { code: 'test' };
  //   const resident = createResident();
  //   const cobaltResident = createCobaltTenant(resident.id);
  //   const residentJsonApi = createResidentJsonApi(resident);
  //   Object.assign(
  //     residentJsonApi.attributes,
  //     createCobaltTenantJsonApiAttrs(cobaltResident)
  //   );
  //   const expected = {
  //     meta: { cobaltTimestamp: 1 },
  //     data: [residentJsonApi],
  //     included: [],
  //   };
  //
  //   // Stup requests
  //   sinon.stub(systemModel, 'findYardiCredentials').resolves(createSnap({}));
  //   sinon.stub(yardi, 'getYardiPropertyResidents').resolves({
  //     residents: [resident],
  //     occupants: [],
  //   });
  //   sinon.stub(cobalt, 'getPropertyTenants').resolves({
  //     timestamp: expected.meta.cobaltTimestamp,
  //     data: [cobaltResident],
  //   });
  //
  //   request(createApp(property))
  //     .get('/t/123')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(200)
  //     .then(res => {
  //       expect(res.body).to.deep.equal(expected);
  //       done();
  //     })
  //     .catch(done);
  // });
// });
//
// function createApp(property) {
//   const app = express();
//   app.get(
//     '/t/:propertyId',
//     stubAuth,
//     stubPropertyCode(property),
//     getPropertyWorkOrders({})
//   );
//   return app;
// }
//
// function stubAuth(req, res, next) {
//   req.user = { id: '123' };
//   next();
// }
//
// function stubPropertyCode(property) {
//   return (req, res, next) => {
//     req.property = property;
//     next();
//   };
// }
//
// function createEmptySnap() {
//   return { val: () => null, exists: () => false };
// }
//
// function createSnap(data = {}) {
//   return { val: () => data, exists: () => true };
// }
//
// function createResidentJsonApi(resident) {
//   const result = {
//     id: resident.id,
//     type: 'resident',
//     attributes: { ...resident },
//   };
//   delete result.attributes.id;
//   delete result.attributes.occupants;
//   if (resident.occupants && resident.occupants.length) {
//     result.relationships = {
//       occupants: {
//         data: resident.occupants.map(id => ({ id, type: 'occupant' })),
//       },
//     };
//   }
//   return result;
// }
