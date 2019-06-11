module.exports = {
  scores: Object.freeze({
    twoactions_checkmarkx: [3, 0, 0, 0, 0],
    twoactions_thumbs: [3, 0, 0, 0, 0],
    threeactions_checkmarkexclamationx: [5, 3, 0, 0, 0],
    threeactions_abc: [3, 1, 0, 0, 0],
    fiveactions_onetofive: [1, 2, 3, 4, 5],
    oneaction_notes: [0, 0, 0, 0, 0],
    signature: [3, 0, 0, 0, 0],
    text_input: [3, 0, 0, 0, 0],
  }),

  deficientListEligible: Object.freeze({
    twoactions_checkmarkx: [false, true],
    twoactions_thumbs: [false, true],
    threeactions_checkmarkexclamationx: [false, true, true],
    threeactions_abc: [false, true, true],
    fiveactions_onetofive: [true, true, true, true, false],
  }),

  valueNames: [
    'mainInputZeroValue',
    'mainInputOneValue',
    'mainInputTwoValue',
    'mainInputThreeValue',
    'mainInputFourValue',
  ],
};
