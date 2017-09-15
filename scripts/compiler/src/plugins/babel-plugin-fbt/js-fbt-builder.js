/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 */

'use strict';
/* eslint max-len: ["warn", 120] */
/* eslint-disable fb-www/comma-dangle */

const invariant = require('invariant');
const {GENDER_CONST} = require('./gender-const.js');
const genderConst = require('./gender-const.js');

const EXACTLY_ONE = '_1';
const VARIATION_GENDER = 0x03000000; // 50331648
const VARIATION_NUMBER = 0x30000000; // 805306368
const INTL_SUBJECT_TOKEN = '__subject__';

const JSFbtBuilder = {
  build(type, texts) {
    if (type === 'text') {
      invariant(texts.length === 1, 'Text type is a singleton array');
      return this.normalizeSpaces(texts[0]);
    } else {
      invariant(type === 'table', 'We only expect two types of fbt phrases');
      return {
        t: this.buildTable(texts),
        m: this.buildMetadata(texts),
      };
    }
  },

  buildMetadata(texts) {
    const metadata = [];
    texts.forEach(function(item) {
      if (typeof item === 'string') {
        return;
      }

      switch (item.type) {
        case 'gender':
        case 'number':
          metadata.push({
            token: item.token,
            mask: item.type === 'number' ? VARIATION_NUMBER : VARIATION_GENDER,
          });
          break;

        case 'plural':
          if (item.showCount !== 'no') {
            metadata.push({
              token: item.name,
              mask: VARIATION_NUMBER,
              singular: true,
            });
          } else {
            metadata.push(null);
          }
          break;

        case 'subject':
          metadata.push({
            token: INTL_SUBJECT_TOKEN,
            mask: VARIATION_GENDER,
          });
          break;
        // We ensure we have placeholders in our metadata because enums and
        // pronoun don't have metadata and will add "levels" to our resulting
        // table. In the example in the docblock of buildTable(), we'd expect
        //     array(null, array('token' => 'count', 'mask' => ...))
        case 'enum':
        case 'pronoun':
        default:
          metadata.push(null);
          break;
      }
    });
    return metadata;
  },

  // Build a tree and set of all the strings - A (potentially multi-level)
  // dictionary of keys of various FBT components (enum, plural, etc) to their
  // string leaves or the next level of the tree.
  //
  // Example (probably a bad example of when to use an enum):
  //   ['Click ',
  //    {
  //      'type' => 'enum',
  //      'values' => array('here', 'there', 'anywhere')
  //    }
  //    ' to see ',
  //    {
  //     'type' => 'number',
  //     'token' => 'count',
  //     'mask' => IntlVariations.NUMBER,
  //    },
  //    'things'
  // )
  // becomes
  //   {
  //     'here' => {'*' => 'Click here to see {count} things'}
  //     'there' => {'*' => 'Click there to see {count} things'}
  //     ...
  //   }
  buildTable(texts) {
    return this.buildTableRecursively('', texts, 0);
  },

  buildTableRecursively(prefix, texts, idx, metadata) {
    if (idx === texts.length) {
      return this.normalizeSpaces(prefix);
    }

    const item = texts[idx];
    if (typeof item === 'string') {
      return this.buildTableRecursively(prefix + texts[idx], texts, idx + 1);
    }

    let textSegments = {};
    switch (item.type) {
      case 'subject':
        textSegments['*'] = '';
        break;
      case 'gender':
      case 'number':
        textSegments['*'] = '{' + item.token + '}';
        break;

      case 'plural':
        textSegments['*'] = item.many;
        textSegments[EXACTLY_ONE] = item.singular;
        break;

      case 'pronoun':
        Object.keys(GENDER_CONST).forEach(function(key) {
          const gender = GENDER_CONST[key];
          if (gender === GENDER_CONST.NOT_A_PERSON && !item.human) {
            return;
          }
          const genderKey = this.getPronounGenderKey(item.usage, gender);
          const pivotKey = genderKey === GENDER_CONST.UNKNOWN_PLURAL
            ? '*'
            : genderKey;
          const word = genderConst.getData(genderKey, item.usage);
          textSegments[pivotKey] = item.capitalize
            ? word.charAt(0).toUpperCase() + word.substr(1)
            : word;
        }, this);
        break;

      case 'enum':
        textSegments = item.values;
        break;

      default:
        break;
    }

    const table = {};
    for (const key in textSegments) {
      table[key] = this.buildTableRecursively(
        prefix + textSegments[key],
        texts,
        idx + 1
      );
    }
    return table;
  },

  // Copied from fbt.js
  getPronounGenderKey(usage, gender) {
    switch (gender) {
      case GENDER_CONST.NOT_A_PERSON:
        return usage === 'object' || usage === 'reflexive'
          ? GENDER_CONST.NOT_A_PERSON
          : GENDER_CONST.UNKNOWN_PLURAL;

      case GENDER_CONST.FEMALE_SINGULAR:
      case GENDER_CONST.FEMALE_SINGULAR_GUESS:
        return GENDER_CONST.FEMALE_SINGULAR;

      case GENDER_CONST.MALE_SINGULAR:
      case GENDER_CONST.MALE_SINGULAR_GUESS:
        return GENDER_CONST.MALE_SINGULAR;

      case GENDER_CONST.MIXED_SINGULAR: // And MIXED_PLURAL; they have the same integer values.
      case GENDER_CONST.FEMALE_PLURAL:
      case GENDER_CONST.MALE_PLURAL:
      case GENDER_CONST.NEUTER_PLURAL:
      case GENDER_CONST.UNKNOWN_PLURAL:
        return GENDER_CONST.UNKNOWN_PLURAL;

      case GENDER_CONST.NEUTER_SINGULAR:
      case GENDER_CONST.UNKNOWN_SINGULAR:
        return usage === 'reflexive'
          ? GENDER_CONST.NOT_A_PERSON
          : GENDER_CONST.UNKNOWN_PLURAL;
    }

    invariant(false, 'Unknown GENDER_CONST value.');
    return null;
  },

  normalizeSpaces(text) {
    return text.replace(/\s+/g, ' ');
  },
};

module.exports = JSFbtBuilder;
