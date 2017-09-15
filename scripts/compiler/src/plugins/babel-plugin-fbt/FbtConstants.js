// Copyright 2004-present Facebook. All Rights Reserved.

// Same set of 'usage' values as in :fbt:pronoun::type. Must match
// PRONOUN_USAGE in fbt.js.
// NOTE: Using 'usage' here, whereas :fbt:pronoun uses 'type'. It's confusing,
// but fbt() already uses 'type' as the tag within the fbt table data for the
// to-be-localized text.

const ValidPronounUsages = {
  object: 0,
  possessive: 1,
  reflexive: 2,
  subject: 3,
};

const PluralRequiredAttributes = {
  count: true,
};

const ShowCount = {
  yes: true,
  no: true,
  ifMany: true,
};

const PluralOptions = {
  value: true, // optional value to replace token (rather than count)
  showCount: ShowCount,
  name: true, // token
  many: true,
};

const ValidPluralOptions = Object.assign(
  {},
  PluralOptions,
  PluralRequiredAttributes
);

const ValidPronounOptions = {
  human: {true: true, false: true},
  capitalize: {true: true, false: true},
};

/**
 * Valid options allowed in the fbt(...) calls.
 */
let ValidFbtOptions = {
  project: true,
  author: true,
  preserveWhitespace: true,
  subject: true,
};

let FbtBooleanOptions = {
  preserveWhitespace: true,
};

const FbtRequiredAttributes = {
  desc: true,
};

const PronounRequiredAttributes = {
  type: true,
  gender: true,
};

const PLURAL_PARAM_TOKEN = 'number';

const RequiredParamOptions = {
  name: true,
};

const ValidParamOptions = Object.assign(
  {
    number: true,
    gender: true,
  },
  RequiredParamOptions
);

module.exports.ValidPronounUsages = ValidPronounUsages;
module.exports.PluralOptions = PluralOptions;
module.exports.PluralRequiredAttributes = PluralRequiredAttributes;
module.exports.ValidPluralOptions = ValidPluralOptions;
module.exports.ValidPronounOptions = ValidPronounOptions;
module.exports.ValidFbtOptions = ValidFbtOptions;
module.exports.FbtBooleanOptions = FbtBooleanOptions;
module.exports.FbtRequiredAttributes = FbtRequiredAttributes;
module.exports.PronounRequiredAttributes = PronounRequiredAttributes;
module.exports.PLURAL_PARAM_TOKEN = PLURAL_PARAM_TOKEN;
module.exports.RequiredParamOptions = RequiredParamOptions;
module.exports.ValidParamOptions = ValidParamOptions;
