const { expect } = require('chai');
const {
  REFUSALS,
  normalizeEmail,
  matchUser,
  refusalFor,
} = require('../membership');

describe('membership', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  John.Smith@Bluecore.COM ')).to.equal(
        'john.smith@bluecore.com'
      );
    });

    it('returns an empty string for missing values', () => {
      [undefined, null, ''].forEach(value => {
        expect(normalizeEmail(value)).to.equal('');
      });
    });
  });

  describe('matchUser', () => {
    const records = [
      { id: 'one', email: 'Existing.User@bluecoreresidential.com' },
      { id: 'two', email: 'other@bluecoreresidential.com' },
    ];

    it('matches regardless of the case an administrator typed', () => {
      const actual = matchUser('existing.user@bluecoreresidential.com', records);
      expect(actual).to.be.an('object');
      expect(actual.id).to.equal('one');
    });

    it('returns null when no record matches', () => {
      expect(matchUser('stranger@gmail.com', records)).to.equal(null);
    });

    it('returns null for a missing email rather than matching a blank record', () => {
      expect(matchUser('', [{ id: 'blank', email: '' }])).to.equal(null);
    });

    it('tolerates an empty or absent collection', () => {
      expect(matchUser('a@b.com', [])).to.equal(null);
      expect(matchUser('a@b.com', undefined)).to.equal(null);
    });
  });

  describe('refusalFor', () => {
    it('allows a known, active user', () => {
      const actual = refusalFor({
        email: 'known@bluecoreresidential.com',
        match: { id: 'one', isDisabled: false },
        providerId: 'google.com',
      });
      expect(actual).to.equal(null);
    });

    it('allows a known user with no isDisabled field at all', () => {
      const actual = refusalFor({
        email: 'known@bluecoreresidential.com',
        match: { id: 'one' },
        providerId: 'google.com',
      });
      expect(actual).to.equal(null);
    });

    it('refuses an unknown Google address and names Google in the copy', () => {
      const actual = refusalFor({
        email: 'stranger@gmail.com',
        match: null,
        providerId: 'google.com',
      });
      expect(actual).to.equal(REFUSALS.unknownGoogle);
    });

    it('refuses an unknown address from any other provider', () => {
      const actual = refusalFor({
        email: 'stranger@gmail.com',
        match: null,
        providerId: 'password',
      });
      expect(actual).to.equal(REFUSALS.unknown);
    });

    it('refuses a deactivated user', () => {
      const actual = refusalFor({
        email: 'known@bluecoreresidential.com',
        match: { id: 'one', isDisabled: true },
        providerId: 'google.com',
      });
      expect(actual).to.equal(REFUSALS.deactivated);
    });

    it('only treats a literal true as deactivated, never a truthy string', () => {
      const actual = refusalFor({
        email: 'known@bluecoreresidential.com',
        match: { id: 'one', isDisabled: 'false' },
        providerId: 'google.com',
      });
      expect(actual).to.equal(null);
    });

    it('refuses when the event carries no email', () => {
      expect(refusalFor({ email: '', match: null })).to.equal(
        REFUSALS.missingEmail
      );
      expect(refusalFor({})).to.equal(REFUSALS.missingEmail);
    });
  });
});
