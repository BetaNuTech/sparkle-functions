const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const teamsModel = require('../../../models/teams');
const usersModel = require('../../../models/users');
const templatesModel = require('../../../models/templates');
const propertiesModel = require('../../../models/properties');
const { db, test, cloudFunctions } = require('../../setup');

describe('Properties | Write | V2', () => {
  afterEach(() => cleanDb(db));

  it("should cleanup team and users removed from the property's team", async () => {
    const propertyId = uuid();
    const teamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const propData = createProperty({ team: teamId });
    const teamData = createTeam({}, propertyId);
    const userData = createUser({}, [teamId, [propertyId]]);

    // Setup Database
    await propertiesModel.createRecord(db, propertyId, propData);
    await teamsModel.createRecord(db, teamId, teamData);
    await usersModel.createRecord(db, user1Id, userData);
    await usersModel.createRecord(db, user2Id, userData);
    const before = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.upsertRecord(db, propertyId, { team: '' }); // remove team
    const after = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(before, after);
    const wrapped = test.wrap(cloudFunctions.propertyWriteV2);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const teamResult = await teamsModel.findRecord(db, teamId);
    const user1Result = await usersModel.findRecord(db, user1Id);
    const user2Result = await usersModel.findRecord(db, user2Id);

    // Assertions
    [
      {
        actual: (teamResult.data() || {}).properties || null,
        expected: {},
        msg: 'removed property from team',
      },
      {
        actual: (user1Result.data() || {}).teams || null,
        expected: { [teamId]: true },
        msg: "removed property from 1st user's teams",
      },
      {
        actual: (user2Result.data() || {}).teams || null,
        expected: { [teamId]: true },
        msg: "removed property from 2nd user's teams",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should add team and users newly added to the property's team", async () => {
    const propertyId = uuid();
    const teamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const propData = createProperty();
    const propUpdate = { team: teamId };
    const teamData = createTeam({}, propertyId);
    const userData = createUser({}, [teamId]);

    // Setup Database
    await propertiesModel.createRecord(db, propertyId, propData);
    await teamsModel.createRecord(db, teamId, teamData);
    await usersModel.createRecord(db, user1Id, userData);
    await usersModel.createRecord(db, user2Id, userData);
    const before = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.upsertRecord(db, propertyId, propUpdate); // remove team
    const after = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(before, after);
    const wrapped = test.wrap(cloudFunctions.propertyWriteV2);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const teamResult = await teamsModel.findRecord(db, teamId);
    const user1Result = await usersModel.findRecord(db, user1Id);
    const user2Result = await usersModel.findRecord(db, user2Id);

    // Assertions
    [
      {
        actual: (teamResult.data() || {}).properties || null,
        expected: { [propertyId]: true },
        msg: 'added property to team',
      },
      {
        actual: (user1Result.data() || {}).teams || null,
        expected: { [teamId]: { [propertyId]: true } },
        msg: "added property to 1st user's teams",
      },
      {
        actual: (user2Result.data() || {}).teams || null,
        expected: { [teamId]: { [propertyId]: true } },
        msg: "added property to 2nd user's teams",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should add team and users to a property's new team", async () => {
    const propertyId = uuid();
    const prevTeamId = uuid();
    const currTeamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const propData = createProperty({ team: prevTeamId });
    const propUpdate = { team: currTeamId };
    const prevTeamData = createTeam({}, propertyId);
    const currTeamData = createTeam({});
    const user1Data = createUser({}, [prevTeamId, [propertyId]]);
    const user2Data = createUser({}, [prevTeamId, [propertyId]], [currTeamId]);

    // Setup Database
    await propertiesModel.createRecord(db, propertyId, propData);
    await teamsModel.createRecord(db, prevTeamId, prevTeamData);
    await teamsModel.createRecord(db, currTeamId, currTeamData);
    await usersModel.createRecord(db, user1Id, user1Data);
    await usersModel.createRecord(db, user2Id, user2Data);
    const before = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.upsertRecord(db, propertyId, propUpdate); // remove team
    const after = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(before, after);
    const wrapped = test.wrap(cloudFunctions.propertyWriteV2);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const prevTeamResult = await teamsModel.findRecord(db, prevTeamId);
    const currTeamResult = await teamsModel.findRecord(db, currTeamId);
    const user1Result = await usersModel.findRecord(db, user1Id);
    const user2Result = await usersModel.findRecord(db, user2Id);

    // Assertions
    [
      {
        actual: (prevTeamResult.data() || {}).properties || null,
        expected: {},
        msg: 'removed property from previous team',
      },
      {
        actual: (currTeamResult.data() || {}).properties || null,
        expected: { [propertyId]: true },
        msg: 'added property to current team',
      },
      {
        actual: (user1Result.data() || {}).teams || null,
        expected: { [prevTeamId]: true },
        msg: "removed property from disassociated 1st user's teams",
      },
      {
        actual: (user2Result.data() || {}).teams || null,
        expected: {
          [prevTeamId]: true,
          [currTeamId]: { [propertyId]: true },
        },
        msg: "updated property in associated 2nd user's teams",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it('should add newly created property associations to templates', async () => {
    const propertyId = uuid();
    const tmplOneId = uuid();
    const tmplTwoId = uuid();
    const propData = createProperty();
    const propUpdate = { templates: { [tmplOneId]: true, [tmplTwoId]: true } };
    const tmplBefore = { name: 'test' };
    const expected = { ...tmplBefore, properties: [propertyId] };

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propData);
    await templatesModel.upsertRecord(db, tmplOneId, tmplBefore);
    await templatesModel.upsertRecord(db, tmplTwoId, tmplBefore);
    const before = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.upsertRecord(db, propertyId, propUpdate);
    const after = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(before, after);
    const wrapped = test.wrap(cloudFunctions.propertyWriteV2);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const results = await Promise.all([
      templatesModel.findRecord(db, tmplOneId),
      templatesModel.findRecord(db, tmplTwoId),
    ]);

    // Assertions
    [
      {
        actual: results[0].data(),
        msg: 'Updated template one property association',
      },
      {
        actual: results[1].data(),
        msg: 'Updated template two property association',
      },
    ].forEach(({ actual, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it('should add updated property associations to templates', async () => {
    const propertyId = uuid();
    const tmplOneId = uuid();
    const tmplTwoId = uuid();
    const propData = createProperty({ templates: { [tmplOneId]: true } });
    const propUpdate = { templates: { [tmplTwoId]: true } }; // replace with #2
    const tmplBefore = { name: 'test' };

    await propertiesModel.createRecord(db, propertyId, propData);
    await templatesModel.upsertRecord(db, tmplOneId, tmplBefore);
    await templatesModel.upsertRecord(db, tmplTwoId, tmplBefore);
    const before = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.upsertRecord(db, propertyId, propUpdate); // Update
    const after = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(before, after);
    const wrapped = test.wrap(cloudFunctions.propertyWriteV2);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const results = await Promise.all([
      templatesModel.findRecord(db, tmplOneId),
      templatesModel.findRecord(db, tmplTwoId),
    ]);

    // Assertions
    [
      {
        actual: results[0].data(),
        expected: { ...tmplBefore, properties: [] },
        msg: 'Updated template one property association',
      },
      {
        actual: results[1].data(),
        expected: { ...tmplBefore, properties: [propertyId] },
        msg: 'Updated template two property association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });
});

function createProperty(config = {}) {
  return {
    name: 'test-prop',
    ...config,
  };
}

function createTeam(config = {}, ...propertyIds) {
  const result = {
    name: 'test-team',
    ...config,
  };

  if (propertyIds) {
    result.properties = result.properties || {};
    propertyIds.forEach(propId => {
      result.properties[propId] = true;
    });
  }

  return result;
}

function createUser(config = {}, ...teams) {
  const result = {
    firstName: 'test',
    lastName: 'user',
    ...config,
  };

  if (Array.isArray(teams)) {
    result.teams = result.teams || {};

    teams.forEach(team => {
      const [teamId, propertyIds] = team;
      if (Array.isArray(propertyIds) && propertyIds.length) {
        propertyIds.forEach(propId => {
          result.teams[teamId] = result.teams[teamId] || {};
          result.teams[teamId][propId] = true;
        });
      } else {
        result.teams[teamId] = true;
      }
    });
  }

  return result;
}
