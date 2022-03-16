module.exports = {
  SCORE_NAMES: [
    'mainInputZeroValue',
    'mainInputOneValue',
    'mainInputTwoValue',
    'mainInputThreeValue',
    'mainInputFourValue',
  ],

  DEFICIENT_LIST_ELIGIBLE: {
    twoactions_checkmarkx: [false, true],
    twoactions_thumbs: [false, true],
    threeactions_checkmarkexclamationx: [false, true, true],
    threeactions_abc: [false, true, true],
    fiveactions_onetofive: [true, true, true, true, false],
  },

  itemTypes: ['main', 'text_input', 'signature'],
  sectionTypes: ['single', 'multi'],
  mainItemTypes: [
    'twoactions_checkmarkx',
    'twoactions_thumbs',
    'threeactions_abc',
    'threeactions_checkmarkexclamationx',
    'fiveactions_onetofive',
    'oneaction_notes',
  ],

  // 2:45 seconds
  reportPdfGenerationMaxTimeout: 165,
  reportPdfMemory: '4GB',
  reportPdfMemoryInBytes: 4000000000, // keep in sync w/ `reportPdfMemory`
};
