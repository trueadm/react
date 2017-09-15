/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 */

'use strict';

function isFbtName(name) {
  return name === 'fbt' || name === 'Fbt';
}

function isFbtElement(node) {
  let nameNode = node.openingElement.name;
  return nameNode.type === 'JSXIdentifier' && isFbtName(nameNode.name);
}

function isFbtCall(node) {
  return node.callee.type === 'Identifier' && isFbtName(node.callee.name);
}

function isFbtMember(node) {
  return node.type === 'MemberExpression' && isFbtName(node.object.name);
}

/**
 * Filter whitespace-only nodes from a list of nodes.
 */
function filterWhiteSpaceNodes(nodes) {
  return nodes.filter(function(node) {
    // Filter whitespace
    return !(node.type === 'JSXText' && node.value.match(/^\s+$/));
  });
}

module.exports.filterWhiteSpaceNodes = filterWhiteSpaceNodes;
module.exports.isFbtElement = isFbtElement;
module.exports.isFbtCall = isFbtCall;
module.exports.isFbtMember = isFbtMember;
module.exports.isFbtName = isFbtName;
