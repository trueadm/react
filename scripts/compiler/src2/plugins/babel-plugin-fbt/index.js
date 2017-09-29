/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @flow
 */

'use strict';

/* eslint consistent-return: 0 */
/* eslint max-len: ["warn", 120] */

// fb-www/comma-dangle checks that various multi-line "list" constructs have trailing commas. Unfortunately, the in-use
// version of Node breaks when such syntax is used in arguments lists for function invocations, the rule implementation
// does not provide a way to override the check for particular grammar elements (like current ESLint's built-in rule),
// and there are quite a few instances in this file where the rule applies. Rather than disabling on a one-by-one basis,
// throw out the baby with the bath water and disable the whole shebang.
/* eslint fb-www/comma-dangle: "off" */

const t = require('babel-core').types;
const JSFbtBuilder = require('./js-fbt-builder');

const docblock = require('./docblock.js');
const autoWrap = require('./fbt-auto-wrap.js');
const {
  normalizeSpaces,
  validateNamespacedFbtElement,
  collectOptions,
  getOptionsFromAttributes,
  getOptionBooleanValue,
  checkOption,
  expandStringConcat,
  getAttributeByNameOrThrow,
} = require('./FbtUtil.js');
const {
  filterWhiteSpaceNodes,
  isFbtCall,
  isFbtElement,
} = require('./FbtNodeChecks.js');
const {
  ValidPluralOptions,
  ValidPronounOptions,
  FbtBooleanOptions,
  FbtRequiredAttributes,
  PLURAL_PARAM_TOKEN,
  ValidFbtOptions,
} = require('./FbtConstants.js');
const fbtMethodCallVisitors = require('./fbt-method-call-vistors.js');
const namespacedElementsArgsHandler = require('./fbt-namespaced-args-handler.js');

/**
 * Default options passed from a docblock.
 */
let defaultOptions;

/**
 * An array containing all collected phrases.
 */
let phrases;

/**
  * An array containing the child to parent relationships for implicit nodes.
  */
let childToParent;

module.exports = function fbt(babel) {
  return {
    pre() {
      this.opts.fbtSentinel = this.opts.fbtSentinel || '__FBT__';
      fbtMethodCallVisitors.setEnumManifest(this.opts.fbtEnumManifest);
      initExtraOptions(this);
      initDefaultOptions(this);
      phrases = [];
      childToParent = {};
    },

    visitor: {
      /**
       * Transform jsx-style <fbt> to fbt() calls.
       */
      JSXElement(path) {
        let node = path.node;

        if (!isFbtElement(node)) {
          return;
        } else if (!node.implicitFbt) {
          autoWrap.createImplicitDescriptions(node);
        }

        giveParentPhraseLocation(node, phrases.length);

        let children = filterWhiteSpaceNodes(node.children).map(
          transformNamespacedFbtElement
        );

        let text = children.length > 1
          ? createConcatFromExpressions(children)
          : children[0];

        let args = [text, getDescAttributeValue(node)];

        // Optional attributes to be passed as options.
        var attrs = node.openingElement.attributes;
        if (attrs.length > 1) {
          args.push(
            getOptionsFromAttributes(
              attrs,
              ValidFbtOptions,
              FbtRequiredAttributes
            )
          );
        }

        let callNode = t.callExpression(t.identifier('fbt'), args);
        if (path.parentPath.node.type === 'JSXElement') {
          callNode = t.jSXExpressionContainer(callNode);
        }

        callNode.loc = node.loc;
        if (node.parentIndex !== undefined) {
          callNode.parentIndex = node.parentIndex;
        }
        path.replaceWith(callNode);
      },

      /**
       * Transform fbt("text", "desc", {project: "project"}) to semantically:
       *
       * fbt._(
       *   fbtSentinel +
       *   JSON.strinfigy({
       *     type: "text",
       *     texts: ["text"],
       *     desc: "desc",
       *     project: "project",
       *   }) +
       *   fbtSentinel
       * );
       */
      CallExpression(path) {
        let node = path.node;

        if (!isFbtCall(node)) {
          return;
        }

        if (node.arguments.length < 2) {
          throw new Error(
            `Expected fbt calls to have at least two arguments. Only ` +
              `${node.arguments.length} was given.`
          );
        }

        // Contains params and enums in the order in which they appear.
        let runtimeArgs = [];
        let variations = {};

        let methodsState = {
          paramSet: {},
          runtimeArgs,
          variations,
          hasTable: false, // can be mutated during `fbtMethodCallVisitors`.
        };

        path.traverse(fbtMethodCallVisitors.call, methodsState);

        let texts;
        let options = collectOptions(node.arguments[2], ValidFbtOptions);
        if (options.subject) {
          methodsState.hasTable = true;
        }
        let isTable =
          Object.keys(variations).length > 0 || methodsState.hasTable;

        for (var key in FbtBooleanOptions) {
          if (options.hasOwnProperty(key)) {
            options[key] = getOptionBooleanValue(options, key);
          }
        }

        if (isTable) {
          texts = normalizeTableTexts(
            extractTableTexts(node.arguments[0], variations)
          );
        } else {
          texts = [
            normalizeSpaces(
              expandStringConcat(node.arguments[0]).value,
              options
            ).trim(),
          ];
        }

        let desc = normalizeSpaces(
          expandStringConcat(node.arguments[1]).value,
          options
        ).trim();

        let phrase = {
          type: isTable ? 'table' : 'text',
          desc: desc,
        };

        if (options.subject) {
          texts.unshift({
            type: 'subject',
          });

          runtimeArgs.push(
            t.callExpression(
              t.memberExpression(
                t.identifier('fbt'),
                t.identifier('subject'),
                false
              ),
              [getOptionAST(node.arguments[2], 'subject')]
            )
          );
        }

        appendOptions(node, phrase, options);
        phrase.jsfbt = JSFbtBuilder.build(phrase.type, texts);

        if (this.opts.collectFbt) {
          if (this.opts.auxiliaryTexts) {
            phrase.texts = texts;
          }

          addPhrase(node, phrase, this);

          if (node.parentIndex !== undefined) {
            addEnclosingString(phrases.length - 1, node.parentIndex);
          }
        }

        let argsOutput = {
          type: phrase.type,
          jsfbt: phrase.jsfbt,
          desc: phrase.desc,
          incl_hash: this.opts.incl_hash,
          project: phrase.project,
        };

        let args = [
          t.stringLiteral(
            this.opts.fbtSentinel +
              JSON.stringify(argsOutput) +
              this.opts.fbtSentinel
          ),
        ];

        if (runtimeArgs.length > 0) {
          args.push(t.arrayExpression(runtimeArgs));
        }

        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('fbt'), t.identifier('_')),
            args
          )
        );
      },
    },
  };
};

function initExtraOptions(state) {
  Object.assign(ValidFbtOptions, state.opts.extraOptions || {});
}

function initDefaultOptions(state) {
  defaultOptions = {};
  let fbtDocblockOptions = docblock.getFromState(state).fbt;
  if (fbtDocblockOptions) {
    defaultOptions = JSON.parse(fbtDocblockOptions);
    Object.keys(defaultOptions).forEach(o => checkOption(o, ValidFbtOptions));
  }
  if (!defaultOptions.project) {
    defaultOptions.project = '';
  }
}

function getDescAttributeValue(node) {
  let descAttr = getAttributeByNameOrThrow(
    node.openingElement.attributes,
    'desc'
  );
  if (!descAttr) {
    throw new Error(`<fbt> requires a "desc" attribute`);
  }
  if (descAttr.value.type === 'JSXExpressionContainer') {
    return descAttr.value.expression;
  }
  return descAttr.value;
}

function extractEnumValues(node) {
  let values = {};
  node.properties.forEach(function(prop) {
    values[prop.key.name || prop.key.value] = prop.value.value;
  });
  return values;
}

/**
 * Appends additional options to the main
 * fbt call argument.
 */
function appendOptions(node, fbtArg, options) {
  Object.assign(fbtArg, defaultOptions);
  Object.assign(fbtArg, options);
}

/**
 * Returns the AST node associated with the key provided, or null if it doesn't exist.
 */
function getOptionAST(options, name) {
  let props = (options && options.properties) || [];
  for (var ii = 0; ii < props.length; ii++) {
    let option = props[ii];
    let curName = option.key.name || option.key.value;
    if (name === curName) {
      return option.value.expression || option.value;
    }
  }
  return null;
}

/**
 * Transform a namespaced fbt JSXElement (or its React equivalent) into a
 * method call. E.g. `<fbt:param>` or <FbtParam> to `fbt.param()`
 */
function transformNamespacedFbtElement(node) {
  switch (node.type) {
    case 'JSXElement':
      return toFbtNamespacedCall(node);
    case 'JSXText':
      return t.stringLiteral(normalizeSpaces(node.value));
    case 'JSXExpressionContainer':
      return t.stringLiteral(
        normalizeSpaces(expandStringConcat(node.expression).value)
      );
    default:
      throw new Error(`Unknown namespace fbt type ${node.type}`);
  }
}

function toFbtNamespacedCall(node) {
  let name = validateNamespacedFbtElement(node.openingElement.name);
  let args = namespacedElementsArgsHandler.getArgs[name](node);
  if (name == 'implicitParamMarker') {
    name = 'param';
  }
  return t.callExpression(
    t.memberExpression(t.identifier('fbt'), t.identifier(name), false),
    args
  );
}

/**
 * Extracts texts that contains variations or enums, contatenating
 * literal parts. Example:
 *
 * "Hello, " + fbt.param('user', user, {gender: 'male'}) + "! " +
 * "Your score is " + fbt.param('score', score) + "!"
 *
 * ["Hello, ", {type: 'gender', token: 'user'}, "! Your score is {score}!"]
 *
 */
function extractTableTexts(node, variations, texts) {
  texts || (texts = []);
  if (node.type === 'BinaryExpression') {
    if (node.operator !== '+') {
      throw new Error(
        `Expected concatenation operator (+) but got ${node.operator}`
      );
    }
    extractTableTexts(node.left, variations, texts);
    extractTableTexts(node.right, variations, texts);
  } else if (node.type === 'StringLiteral') {
    // If we already collected a literal part previously, and
    // current part is a literal as well, just concatenate them.
    let previousText = texts[texts.length - 1];
    if (typeof previousText === 'string') {
      texts[texts.length - 1] = normalizeSpaces(previousText + node.value);
    } else {
      texts.push(node.value);
    }
  } else if (node.type === 'CallExpression') {
    if (node.callee.property.name === 'param') {
      texts.push(variations[node.arguments[0].value]);
    } else if (node.callee.property.value === 'enum') {
      texts.push({
        type: 'enum',
        values: extractEnumValues(node.arguments[1]),
      });
    } else if (node.callee.property.name === 'plural') {
      let singular = node.arguments[0].value;
      let opts = collectOptions(node.arguments[2], ValidPluralOptions);
      let defaultToken = opts.showCount && opts.showCount !== 'no'
        ? PLURAL_PARAM_TOKEN
        : null;
      if (opts.showCount === 'ifMany' && !opts.many) {
        throw new Error(
          "The 'many' attribute must be set explicitly if showing count only " +
            " on 'ifMany', since the singular form presumably starts with an article"
        );
      }

      let data = Object.assign(
        {
          type: 'plural',
          showCount: 'no',
          name: defaultToken,
          singular: singular,
          many: singular + 's',
        },
        opts
      );

      if (data.showCount !== 'no') {
        if (data.showCount === 'yes') {
          data.singular = '1 ' + data.singular;
        }
        data.many = '{' + data.name + '} ' + data.many;
      }
      texts.push(data);
    } else if (node.callee.property.name === 'pronoun') {
      // Usage: fbt.pronoun(usage, gender [, options])
      let options = collectOptions(node.arguments[2], ValidPronounOptions);
      for (let key of Object.keys(options)) {
        options[key] = getOptionBooleanValue(options, key);
      }
      let data = Object.assign(
        {
          type: 'pronoun',
          usage: node.arguments[0].value,
        },
        options
      );
      texts.push(data);
    } else if (node.callee.property.name === 'name') {
      texts.push(variations[node.arguments[0].value]);
    }
  }

  return texts;
}

/**
 * Normalizes first and last elements in the
 * table texts by triming them left and right accordingly.
 * [" Hello, ", {enum}, " world! "] -> ["Hello, ", {enum}, " world!"]
 */
function normalizeTableTexts(texts) {
  let firstText = texts[0];
  if (firstText && typeof firstText === 'string') {
    texts[0] = firstText.trimLeft();
  }
  let lastText = texts[texts.length - 1];
  if (lastText && typeof lastText === 'string') {
    texts[texts.length - 1] = lastText.trimRight();
  }
  return texts;
}

/**
 * Given an array of nodes, recursively construct a concatenation of all
 * these nodes.
 */
function createConcatFromExpressions(nodes) {
  if (nodes.length === 0) {
    throw new Error(`Cannot create an expression without nodes.`);
  }
  return nodes.reduceRight(function(rest, node) {
    return t.binaryExpression('+', node, rest);
  });
}

/** Given a node, and its index location in phrases, any children of the given
  * node that are implicit are given their parent's location. This can then
  * be used to link the inner strings with their enclosing string.
  */
function giveParentPhraseLocation(parentNode, parentIdx) {
  if (!parentNode.children) {
    return;
  }
  for (let ii = 0; ii < parentNode.children.length; ++ii) {
    let child = parentNode.children[ii];
    if (child.implicitDesc) {
      child.parentIndex = parentIdx;
    }
  }
}

function addPhrase(node, phrase, state) {
  let filepath = state.opts.filepath;
  phrases.push(
    Object.assign(
      {
        filepath: filepath,
        line_beg: node.loc.start.line,
        col_beg: node.loc.start.column,
        line_end: node.loc.end.line,
        col_end: node.loc.end.column,
      },
      phrase
    )
  );
}

function addEnclosingString(childIdx, parentIdx) {
  childToParent[childIdx] = parentIdx;
}

module.exports.getExtractedStrings = function() {
  return phrases;
};

module.exports.getChildToParentRelationships = function() {
  return childToParent || {};
};
