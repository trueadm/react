/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 */

'use strict';

const t = require('babel-core').types;
const {
  filterWhiteSpaceNodes,
} = require('./FbtNodeChecks.js');
const {
  normalizeSpaces,
  validateNamespacedFbtElement,
  getAttributeByNameOrThrow,
} = require('./FbtUtil.js');
const FbtParamType = {
  IMPLICICT: 'implicit',
  EXPLICIT: 'explicit',
  NULL: 'null',
};

/**
  * Given a node that is a child of an <fbt> node and the phrase that the node
  * is within, the implicit node becomes the child of a new <fbt> node.
  */
function wrapImplicitFBTParam(node) {
  var fbtJSXIdentifier = t.JSXIdentifier('fbt');
  var openingElement = t.JSXOpeningElement(fbtJSXIdentifier, [
    createDescAttribute(node),
  ]);
  openingElement.selfClosing = false;
  var closingElement = t.JSXClosingElement(fbtJSXIdentifier);
  var fbtNode = t.JSXElement(openingElement, closingElement, []);
  fbtNode.loc = node.loc;
  fbtNode.implicitFbt = true;
  fbtNode.children = node.children;
  node.paramName = normalizeSpaces(collectRawString(node)).trim();
  if (node.parentIndex !== undefined) {
    fbtNode.parentIndex = node.parentIndex;
  }
  node.children = [fbtNode];
  return node;
}

/**
  * Given a node, this function creates a JSXIdentifier with the the node's
  * implicit description as the description.
  */
function createDescAttribute(node) {
  var descIdentifier = t.JSXIdentifier('desc');
  var descString = t.StringLiteral(
    'In the phrase: "' + node.implicitDesc + '"'
  );
  return t.JSXAttribute(descIdentifier, descString);
}

/**
  * Returns either the string contained with a JSXText node.
  */
function getLeafNodeString(node) {
  return node.type === 'JSXText' ? normalizeSpaces(node.value) : '';
}

/**
  * Collects the raw strings below a given node. Explicit fbt param nodes
  * amend their 'name' attribute wrapped with [ ] only if they are the
  * child of the base node.
  * @param {bool} child - False initially, true when the function
  * recursively calls itself with children nodes so only explicit <fbt:param>
  * children are wrapped and not the base node.
  */
function collectRawString(node, child) {
  if (!node.children) {
    return getLeafNodeString(node);
  } else if (getParamType(node) === FbtParamType.EXPLICIT && child) {
    return '[' + getExplicitParamName(node) + ']';
  } else {
    var filteredChildren = filterWhiteSpaceNodes(node.children);
    let string = filteredChildren.map(c => collectRawString(c, true)).join('');
    return normalizeSpaces(string.trim());
  }
}

function getExplicitParamName(node) {
  let nameAttr = getAttributeByNameOrThrow(
    node.openingElement.attributes,
    'name'
  );
  return nameAttr.value.value;
}

/**
  * Given a parent <fbt> node, calls createDescriptionsWithStack with an
  * empty stack to be filled
  */
function createImplicitDescriptions(node) {
  createDescriptionsWithStack(node, []);
}

/**
  * Creates the description for all children nodes that are implicitly
  * <fbt:param> nodes by creating the queue that is the path from the parent
  * fbt node to each node.
  */
function createDescriptionsWithStack(node, stack) {
  stack.push(node);
  if (node.children) {
    var filteredChildren = filterWhiteSpaceNodes(node.children);
    for (let ii = 0; ii < filteredChildren.length; ++ii) {
      let child = filteredChildren[ii];
      let openingElement = child.openingElement;
      if (child.type === 'JSXElement' &&
        openingElement.name &&
        validateNamespacedFbtElement(openingElement.name)
        === 'implicitParamMarker') {
        child.implicitDesc = collectTokenStringFromStack(stack, 0);
      }
      createDescriptionsWithStack(child, stack);
    }
  }
  stack.pop();
}

/**
  * Collects the token string from the stack by tokenizing the children of the
  * target implicit param, as well as other implicit or explicit <fbt:param>
  * nodes that do not contain the current implicit node.
  * The stack looks like:
  * [topLevelNode, ancestor1, ..., immediateParent, targetNode]
  */
function collectTokenStringFromStack(nodeStack, index) {
  if (index >= nodeStack.length) {
    return '';
  }
  var tokenString = '';
  var currentNode = nodeStack[index];
  let nextNode = nodeStack[index + 1];
  var filteredChildren = filterWhiteSpaceNodes(currentNode.children);
  for (let ii = 0; ii < filteredChildren.length; ++ii) {
    let child = filteredChildren[ii];
    if (child === nextNode) {
      // If node is is on our ancestor path, descend recursively to
      // construct the string
      tokenString += collectTokenStringFromStack(nodeStack, index + 1);
    } else {
      let suffix = collectRawString(child);
      if (child === currentNode || isImplicitOrExplicitParam(child)) {
        suffix = tokenizeString(suffix);
      }
      tokenString += suffix;
    }
  }
  return tokenString.trim();
}

/**
  * Given a string, returns the same string wrapped with a token marker.
  */
function tokenizeString(s) {
  return '{=' + s + '}';
}

function isImplicitOrExplicitParam(node) {
  return getParamType(node) !== FbtParamType.NULL;
}

/**
  * Returns if the node is implicitly or explicitly a <fbt:param>
  */
function getParamType(node) {
  if (node.type !== 'JSXElement') {
    return FbtParamType.NULL;
  }
  let nodeFBTElementType = validateNamespacedFbtElement(
    node.openingElement.name
  );
  switch (nodeFBTElementType) {
    case 'implicitParamMarker':
      return FbtParamType.IMPLICICT;
    case 'param':
    case 'FbtParam':
      return FbtParamType.EXPLICIT;
    default:
      return FbtParamType.NULL;
  }
}

module.exports.wrapImplicitFBTParam = wrapImplicitFBTParam;
module.exports.createImplicitDescriptions = createImplicitDescriptions;
