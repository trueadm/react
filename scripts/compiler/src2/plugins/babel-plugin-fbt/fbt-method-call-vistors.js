/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * Started by the parent `fbt()` calls visitor (`fbt.CallExpression`) to visit
 * all children with method calls (fbt.param, fbt.enum, etc). Also collects
 * these calls into `params` and `enums` for further processing by parent
 * visitor.
 *
 */
'use strict';

/* eslint fb-www/comma-dangle: "off" */
// See explaination in /js/fb-transforms/babel-6/babel-plugin-fbt/index.js

const t = require('babel-core').types;
const {
  getVariationValue,
  verifyUniqueToken,
  collectOptions,
  getOptionBooleanValue,
} = require('./FbtUtil.js');
const {
  ValidPronounUsages,
  ValidPronounOptions,
  ValidPluralOptions,
} = require('./FbtConstants.js');
const {isFbtMember} = require('./FbtNodeChecks.js');
const PLURAL_PARAM_TOKEN = 'number';

/**
  * Variations.
  */
const Variation = {
  number: 0,
  gender: 1,
};

/**
  * Map of alias to module name.
  */
let fbtEnumRequireMap = {};

let enumManifest;

function setEnumManifest(manifest) {
  enumManifest = manifest;
}

function setFbtEnumRequireMap(alias, moduleName) {
  fbtEnumRequireMap[alias] = moduleName;
}

let call = {
  CallExpression(path) {
    let node = path.node;

    let runtimeArgs = this.runtimeArgs;
    let variations = this.variations;

    let callee = node.callee;

    if (!isFbtMember(callee)) {
      return;
    }

    if (callee.property.type !== 'Identifier') {
      throw new Error(
        `Expected fbt method to be an identifier, but got ` +
          callee.property.type
      );
    }

    if (
      callee.property.name === 'param' ||
      callee.property.name === 'sameParam'
    ) {
      if (node.arguments[0].type !== 'StringLiteral') {
        throw new Error(
          `Expected first argument to fbt.param to be a string, but got ` +
            node.arguments[0].type
        );
      }
      // Collect params only if it's original one (not "sameParam").
      if (callee.property.name === 'param') {
        runtimeArgs.push(node);
        verifyUniqueToken(node.arguments[0].value, this.paramSet);
      }

      // Variation case. Replace:
      // {number: true}     -> {type: "number", token: <param-name>}
      // {gender: <gender>} -> {type: "gender", token: <param-name>}
      if (node.arguments.length === 3) {
        let paramName = node.arguments[0].value;
        let variationInfo = node.arguments[2].properties[0];
        let variationName = variationInfo.key.name || variationInfo.key.value;
        variations[paramName] = {
          type: variationName,
          token: paramName,
        };
        let variationValues = [t.numericLiteral(Variation[variationName])];
        let variationValue = getVariationValue(variationName, variationInfo);
        if (variationValue) {
          variationValues.push(variationValue);
        }
        // The actual value of the variation, e.g. [0] for number,
        // or [1, <gender>] for gender.
        node.arguments[2] = t.arrayExpression(variationValues);
        return;
      }

      // Else, simple param, encoded directly into
      // the string as {<param-name>}.
      path.replaceWith(t.stringLiteral('{' + node.arguments[0].value + '}'));
    } else if (callee.property.name === 'enum') {
      this.hasTable = true;
      // `enum` is a reserved word so it should be quoted.
      node.callee.computed = true;
      node.callee.property = t.stringLiteral('enum');

      let valuesArg = node.arguments[1];
      let props;
      if (valuesArg.type === 'ArrayExpression') {
        props = valuesArg.elements.map(function(val) {
          return t.objectProperty(val, val);
        });
      } else if (valuesArg.type === 'ObjectExpression') {
        props = valuesArg.properties.map(function(prop) {
          if (prop.key.type === 'Identifier') {
            return t.objectProperty(t.stringLiteral(prop.key.name), prop.value);
          } else {
            return prop;
          }
        });
      } else if (t.isIdentifier(valuesArg)) {
        let moduleName = fbtEnumRequireMap[valuesArg.name];
        props = Object.keys(enumManifest[moduleName]).map(function(enumKey) {
          return t.objectProperty(
            t.stringLiteral(enumKey),
            t.stringLiteral(enumManifest[moduleName][enumKey])
          );
        });
      } else {
        throw new Error(
          'Expected an array or object as a second argument in `fbt.enum`'
        );
      }
      node.arguments[1] = t.objectExpression(props);

      runtimeArgs.push(node);
    } else if (callee.property.name === 'plural') {
      this.hasTable = true;
      let count = node.arguments[1];
      let options = collectOptions(node.arguments[2], ValidPluralOptions);
      let pluralArgs = [count];
      if (options.showCount && options.showCount !== 'no') {
        let name = options.name || PLURAL_PARAM_TOKEN;
        verifyUniqueToken(name, this.paramSet);
        pluralArgs.push(t.stringLiteral(name));
        if (options.value) {
          pluralArgs.push(options.value);
        }
      }

      runtimeArgs.push(
        t.callExpression(
          t.memberExpression(
            t.identifier('fbt'),
            t.identifier('plural'),
            false
          ),
          pluralArgs
        )
      );
    } else if (callee.property.name === 'pronoun') {
      // Usage: fbt.pronoun(usage, gender [, options])
      // - enum string usage
      //    e.g. 'object', 'possessive', 'reflexive', 'subject'
      // - enum int gender
      //    e.g. GenderConst.MALE_SINGULAR, FEMALE_SINGULAR, etc.

      this.hasTable = true;

      if (node.arguments.length < 2 || 3 < node.arguments.length) {
        throw new Error(
          `Expected '(usage, gender [, options])' arguments to fbt.pronoun`
        );
      }

      let usageExpr = node.arguments[0];
      if (usageExpr.type !== 'StringLiteral') {
        throw new Error(
          `First argument to fbt.pronoun must be a StringLiteral, got ` +
            usageExpr.type
        );
      }
      if (!ValidPronounUsages.hasOwnProperty(usageExpr.value)) {
        let usages = Object.keys(ValidPronounUsages);
        throw new Error(
          `First argument to fbt.pronoun must be one of [${usages}], ` +
            `got ${usageExpr.value}`
        );
      }
      let numericUsageExpr = t.numericLiteral(
        ValidPronounUsages[usageExpr.value]
      );
      let genderExpr = node.arguments[1];
      let pronounArgs = [numericUsageExpr, genderExpr];

      let optionsExpr = node.arguments[2];
      let options = collectOptions(optionsExpr, ValidPronounOptions);
      if (getOptionBooleanValue(options, 'human')) {
        pronounArgs.push(
          t.objectExpression([
            t.objectProperty(t.identifier('human'), t.numericLiteral(1)),
          ])
        );
      }

      runtimeArgs.push(
        t.callExpression(
          t.memberExpression(
            t.identifier('fbt'),
            t.identifier('pronoun'),
            false
          ),
          pronounArgs
        )
      );
    } else if (callee.property.name === 'name') {
      if (node.arguments[0].type !== 'StringLiteral') {
        throw new Error(
          `Expected first argument to fbt.name to be a string, but got ` +
            node.arguments[0].type
        );
      }
      if (node.arguments.length < 3) {
        throw new Error(
          `Missing arguments. Must have three arguments: label, value, gender`
        );
      }
      let paramName = node.arguments[0].value;
      variations[paramName] = {
        type: 'gender',
        token: paramName,
      };
      runtimeArgs.push(node);
    } else {
      throw new Error(`Unknown fbt method ${callee.property.name}`);
    }
  },
};

module.exports.setEnumManifest = setEnumManifest;
module.exports.setFbtEnumRequireMap = setFbtEnumRequireMap;
module.exports.call = call;
