/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * Fbt JSX namespaced elements handler.
 *
 */

'use strict';

/* eslint fb-www/comma-dangle: "off" */
// See explaination in /js/fb-transforms/babel-6/babel-plugin-fbt/index.js

const autoWrap = require('./fbt-auto-wrap.js');
const t = require('babel-core').types;
const {
  getOptionsFromAttributes,
  getAttributeByNameOrThrow,
  expandStringConcat,
  normalizeSpaces,
} = require('./FbtUtil.js');
const {filterWhiteSpaceNodes} = require('./FbtNodeChecks.js');
const {
  ValidParamOptions,
  RequiredParamOptions,
  PluralOptions,
  PluralRequiredAttributes,
  ValidPronounOptions,
  ValidPronounUsages,
  PronounRequiredAttributes,
} = require('./FbtConstants.js');

let getArgs = {
  /**
     * Node that is a child of a <fbt> node that should be handled as
     * <fbt:param>
     */
  implicitParamMarker(node) {
    let newNode = autoWrap.wrapImplicitFBTParam(node);
    return [t.stringLiteral('=' + newNode.paramName), newNode];
  },

  /**
    * <fbt:param> or <FbtParam>
    */
  param(node) {
    let attributes = node.openingElement.attributes;
    let nameAttr = getAttributeByNameOrThrow(attributes, 'name');
    let options = getOptionsFromAttributes(
      attributes,
      ValidParamOptions,
      RequiredParamOptions
    );
    let children = filterWhiteSpaceNodes(node.children);

    let paramChildren = children.filter(function(child) {
      return (
        (child.type === 'JSXExpressionContainer' &&
          child.expression &&
          // Allow users to insert JSX comments with empty JSX expression
          // containers. See:
          // https://astexplorer.net/#/gist/e011b6605d699e57433eb439a6488106/bb402dd2c680a1d2f38ddcc1f6e11ef72d276cbc
          child.expression.type !== 'JSXEmptyExpression') ||
        child.type === 'JSXElement'
      );
    });

    if (paramChildren.length !== 1) {
      throw new Error(
        `fbt:param expects an {expression} or JSX element, and only one`
      );
    }

    let nameAttrValue = nameAttr.value;
    if (nameAttrValue.loc.end.line > nameAttrValue.loc.start.line) {
      nameAttrValue.value = normalizeSpaces(nameAttrValue.value);
    }
    let paramArgs = [
      nameAttrValue,
      paramChildren[0].expression || paramChildren[0],
    ];

    if (options.properties.length > 0) {
      paramArgs.push(options);
    }

    return paramArgs;
  },

  /**
    * <fbt:plural> or <FbtPlural>
    */
  plural(node) {
    let attributes = node.openingElement.attributes;
    let options = getOptionsFromAttributes(
      attributes,
      PluralOptions,
      PluralRequiredAttributes
    );
    let countAttr = getAttributeByNameOrThrow(attributes, 'count').value;
    let children = filterWhiteSpaceNodes(node.children);
    let pluralChildren = children.filter(function(child) {
      return (
        child.type === 'JSXText' || child.type === 'JSXExpressionContainer'
      );
    });
    if (pluralChildren.length !== 1) {
      throw new Error('fbt:plural expects text or an expression, and only one');
    }
    let singularNode = pluralChildren[0];
    let singularText = expandStringConcat(
      singularNode.expression || singularNode
    );
    let singularArg = t.stringLiteral(
      normalizeSpaces(singularText.value).trimRight()
    );
    return [singularArg, countAttr.expression, options];
  },

  /**
    * <fbt:pronoun> or <FbtPronoun>
    */
  pronoun(node) {
    if (!node.openingElement.selfClosing) {
      throw new Error('fbt:pronoun must be a self-closing element');
    }

    let attributes = node.openingElement.attributes;

    let typeAttr = getAttributeByNameOrThrow(attributes, 'type').value;
    if (typeAttr.type !== 'StringLiteral') {
      throw new Error(
        'fbt:pronoun attribute "type" must have StringLiteral content'
      );
    }
    if (!ValidPronounUsages.hasOwnProperty(typeAttr.value)) {
      throw new Error(
        'fbt:pronoun attribute "type" must be one of [' +
          Object.keys(ValidPronounUsages) +
          ']'
      );
    }
    let result = [t.stringLiteral(typeAttr.value)];

    let genderExpr = getAttributeByNameOrThrow(attributes, 'gender').value;
    result.push(genderExpr.expression);

    let options = getOptionsFromAttributes(
      attributes,
      ValidPronounOptions,
      PronounRequiredAttributes
    );
    if (0 < options.properties.length) {
      result.push(options);
    }

    return result;
  },

  /**
    * <fbt:name> or <FbtName>
    */
  name(node) {
    let attributes = node.openingElement.attributes;
    let nameAttribute = getAttributeByNameOrThrow(attributes, 'name').value;
    let genderAttribute = getAttributeByNameOrThrow(attributes, 'gender').value;

    let children = filterWhiteSpaceNodes(node.children);
    let nameChildren = children.filter(function(child) {
      return (
        child.type === 'JSXText' || child.type === 'JSXExpressionContainer'
      );
    });
    if (nameChildren.length !== 1) {
      throw new Error('fbt:name expects text or an expression, and only one');
    }

    let singularArg = nameChildren[0].expression || nameChildren[0];

    return [nameAttribute, singularArg, genderAttribute.expression];
  },

  /**
    * <fbt:same-param> or <FbtSameParam>
    */
  sameParam(node) {
    if (!node.openingElement.selfClosing) {
      throw new Error(`Expected fbt same param to be selfClosing.`);
    }

    let nameAttr = getAttributeByNameOrThrow(
      node.openingElement.attributes,
      'name'
    );

    return [nameAttr.value];
  },

  /**
    * <fbt:enum> or <FbtEnum>
    */
  enum(node) {
    if (!node.openingElement.selfClosing) {
      throw new Error(`Expected fbt enum to be selfClosing.`);
    }

    let rangeAttr = getAttributeByNameOrThrow(
      node.openingElement.attributes,
      'enum-range'
    );

    if (rangeAttr.value.type !== 'JSXExpressionContainer') {
      throw new Error(
        'Expected JSX Expression for enum-range attribute but got ' +
          rangeAttr.value.type
      );
    }

    let valueAttr = getAttributeByNameOrThrow(
      node.openingElement.attributes,
      'value'
    );

    if (valueAttr.value.type !== 'JSXExpressionContainer') {
      throw new Error(
        `Expected value attribute of <fbt:enum> to be an expression ` +
          `but got ${valueAttr.value.type}`
      );
    }

    return [valueAttr.value.expression, rangeAttr.value.expression];
  },
};

module.exports.getArgs = getArgs;
