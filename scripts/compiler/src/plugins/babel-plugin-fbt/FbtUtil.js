/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 */

'use strict';

const t = require('babel-core').types;

function normalizeSpaces(value, options) {
  if (options && options.preserveWhitespace) {
    return value;
  }
  return value.replace(/\s+/g, ' ');
}

/**
 * Validates allowed children inside <fbt>.
 * Currently allowed:
 *   <fbt:param>, <FbtParam>
 *   <fbt:enum>,  <FbtEnum>
 *   <fbt:name>,  <FbtName>
 * And returns a name of a corresponding handler.
 * If a child is not valid, it is flagged as an Implicit Parameter and is
 * automatically wrapped with <fbt:param>
 * @param node - The node that contains the name of any parent node. For
 * example, for a JSXElement, the containing name is the openingElement's name.
 */
function validateNamespacedFbtElement(node) {
  let valid = false;
  let handlerName;

  // Actual namespaced version, e.g. <fbt:param>
  if (node.type === 'JSXNamespacedName') {
    handlerName = node.name.name;
    valid =
      node.namespace.type === 'JSXIdentifier' &&
      node.namespace.name === 'fbt' &&
      (handlerName === 'enum' ||
        handlerName === 'param' ||
        handlerName === 'plural' ||
        handlerName === 'pronoun' ||
        handlerName === 'name' ||
        handlerName === 'same-param');
    // React's version, e.g. <FbtParam>, or <FbtEnum>
  } else if (node.type === 'JSXIdentifier') {
    handlerName = node.name.substr(3).toLowerCase();
    valid =
      node.name === 'FbtEnum' ||
      node.name === 'FbtParam' ||
      node.name === 'FbtPlural' ||
      node.name === 'FbtPronoun' ||
      node.name === 'FbtName' ||
      node.name === 'FbtSameParam';
  }

  if (!valid) {
    handlerName = 'implicitParamMarker';
  }

  if (handlerName === 'same-param' || handlerName === 'sameparam') {
    handlerName = 'sameParam';
  }

  return handlerName;
}

function isTextualNode(node) {
  if (node.type === 'StringLiteral' || node.type === 'JSXText') {
    return true;
  } else if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isTextualNode(node.left) && isTextualNode(node.right);
  }
  return false;
}

function verifyUniqueToken(name, paramSet) {
  if (paramSet[name]) {
    throw new Error(
      "There's already a token with the same name, '" +
        name +
        "' in this fbt call. Use fbt.sameParam if you want to reuse the " +
        'same token value or give this token a different name'
    );
  }
  paramSet[name] = true;
}

function checkOption(option, validOptions, value) {
  let validValues = validOptions[option];
  if (!validOptions.hasOwnProperty(option) || validValues === undefined) {
    throwAt(
      value,
      `Invalid option "${option}". ` +
        `Only allowed: ${Object.keys(validOptions).join(', ')} `
    );
  } else if (validValues !== true) {
    let valueStr = value && value.value;
    if (!validValues[valueStr]) {
      throw new Error(
        `Invalid value, "${valueStr}" for "${option}". ` +
          `Only allowed: ${Object.keys(validValues).join(', ')}`
      );
    }
  }
  return option;
}

/**
 * Build options list form corresponding attributes.
 */
function getOptionsFromAttributes(attributesNode, validOptions, ignoredAttrs) {
  let options = [];

  attributesNode.forEach(function(node) {
    let option = node.name.name;

    // Ignored attributes are passed as a separate argument in the fbt(...)
    // call, because they're required. They're not passed as options.
    if (ignoredAttrs[option]) {
      return;
    }

    let value = node.value;
    if (value.type === 'JSXExpressionContainer') {
      value = value.expression;
    } else if (
      value.type === 'StringLiteral' &&
      (value.value === 'true' || value.value === 'false')
    ) {
      value = t.booleanLiteral(value.value === 'true');
    }

    options.push(
      t.objectProperty(
        t.stringLiteral(checkOption(option, validOptions, value)),
        value
      )
    );
  });

  return t.objectExpression(options);
}

function throwAt(astNode, msg) {
  throw new Error(`Line ${astNode.loc.start.line}: ${msg}`);
}

function checkOptions(properties, validOptions) {
  properties.forEach(function(node) {
    let key = node.key;
    checkOption(key.name || key.value, validOptions, node.value);
  });
  return properties;
}

function collectOptions(options, validOptions) {
  if (options && options.type !== 'ObjectExpression') {
    throw new Error(`fbt(...) expects an ObjectExpression as its 3rd argument`);
  }
  let key2value = {};
  let props = (options && options.properties) || [];
  checkOptions(props, validOptions).forEach(function(option) {
    let value = option.value.expression || option.value;
    let name = option.key.name || option.key.value;
    // Append only default valid options excluding "extraOptions",
    // which are used only by specific runtimes.
    if (validOptions.hasOwnProperty(name)) {
      key2value[name] = isTextualNode(value)
        ? normalizeSpaces(expandStringConcat(value).value)
        : value;
    }
  });
  return key2value;
}

/**
 * Given a node that could be a recursive binary operation over string literals
 * (i.e. string concatenation), expand it into a string literal.
 */
function expandStringConcat(node) {
  if (node.type === 'BinaryExpression') {
    if (node.operator !== '+') {
      throw new Error(
        `Expected concatenation operator (+) but got ${node.operator}`
      );
    }
    return t.stringLiteral(
      expandStringConcat(node.left).value + expandStringConcat(node.right).value
    );
  } else if (node.type === 'StringLiteral') {
    return node;
  } else if (node.type === 'JSXText') {
    return node;
  } else {
    throw new Error(
      'Expected string literal or concatenation, but got ' + node.type
    );
  }
}

function getOptionBooleanValue(options, name) {
  if (!options.hasOwnProperty(name)) {
    return false;
  }
  let value = options[name];
  if (t.isBooleanLiteral(value)) {
    return value.value;
  }
  if (value.expression) {
    throw new Error(`Expression not permitted for option "${name}".`);
  } else {
    throw new Error(
      `Value for option "${name}" must be Boolean literal 'true' or 'false'.`
    );
  }
}

function getVariationValue(variationName, variationInfo) {
  // Numbers allow only `true` or expression.
  if (
    variationName === 'number' &&
    variationInfo.value.type === 'BooleanLiteral'
  ) {
    if (variationInfo.value.value !== true) {
      throw new Error(
        "fbt.param's number option should be an expression or 'true'"
      );
    }
    // For number="true" we don't pass additional value.
    return null;
  }

  return variationInfo.value;
}

/**
  * Utility for getting the first attribute by name from a list of attributes.
  */
function getAttributeByNameOrThrow(attributes, name) {
  let attr = getAttributeByName(attributes, name);
  if (attr === undefined) {
    throw new Error(`Unable to find attribute ${name}.`);
  }
  return attr;
}

function getAttributeByName(attributes, name) {
  for (let i = 0; i < attributes.length; i++) {
    let attr = attributes[i];
    if (attr.type === 'JSXAttribute' && attr.name.name === name) {
      return attr;
    }
  }
  return undefined;
}

module.exports.normalizeSpaces = normalizeSpaces;
module.exports.validateNamespacedFbtElement = validateNamespacedFbtElement;
module.exports.verifyUniqueToken = verifyUniqueToken;
module.exports.getVariationValue = getVariationValue;
module.exports.collectOptions = collectOptions;
module.exports.getOptionsFromAttributes = getOptionsFromAttributes;
module.exports.expandStringConcat = expandStringConcat;
module.exports.getOptionBooleanValue = getOptionBooleanValue;
module.exports.checkOption = checkOption;
module.exports.getAttributeByNameOrThrow = getAttributeByNameOrThrow;
