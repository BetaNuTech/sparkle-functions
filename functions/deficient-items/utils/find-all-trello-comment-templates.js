const assert = require('assert');

const { isArray } = Array;

/**
 * Curry function for find all function
 * @param  {Object} templateConfiguration
 * @return {Function}
 */
module.exports = function createTrelloCommentFindAll(templateConfiguration) {
  assert(
    templateConfiguration &&
      typeof templateConfiguration === 'object' &&
      isArray(templateConfiguration.transitions) &&
      isArray(templateConfiguration.states) &&
      templateConfiguration.default &&
      typeof templateConfiguration.default === 'string',
    'has valid trello template comment configuration'
  );

  /**
   * Find all templates applicable to transition
   * current state or default template
   * @param  {String} previousState
   * @param  {String} currentState
   * @return {String[]} - List of all applicable template strings
   */
  return (previousState, currentState) => {
    assert(
      previousState && typeof previousState === 'string',
      'has previous state'
    );
    assert(
      currentState && typeof currentState === 'string',
      'has current state'
    );

    const result = [];

    // Add template matches
    templateConfiguration.transitions.forEach(
      ({ previous, current, value }) => {
        if (
          previous.includes(previousState) &&
          current.includes(currentState)
        ) {
          result.push(`${value}`);
        }
      }
    );

    // Add state matches
    templateConfiguration.states.forEach(({ name, value }) => {
      if (name === currentState) {
        result.push(`${value}`);
      }
    });

    // Add default template
    result.push(`${templateConfiguration.default}`);

    return result;
  };
};
