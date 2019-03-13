/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Props} from './ReactDOMHostConfig';

import {HostComponent} from 'shared/ReactWorkTags';
import warningWithoutStack from 'shared/warningWithoutStack';
import type {Fiber} from 'react-reconciler/src/ReactFiber';

const excludeElementsFromHitSlop = new Set([
  'IFRAME',
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'SELECT',
  'INPUT',
  'TEXTAREA',
  'KEYGEN',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
  'MENUITEM',
  'VIDEO',
  'AUDIO',
  'SCRIPT',
  'STYLE',
  'CANVAS',
]);

function getChildDomElementsFromFiber(
  fiber: Fiber,
): Array<Element | Document | Node> {
  const domElements = [];
  let currentFiber = fiber.child;

  while (currentFiber !== null) {
    if (currentFiber.tag === HostComponent) {
      domElements.push(currentFiber.stateNode);
      currentFiber = currentFiber.return;
      if (currentFiber === fiber) {
        break;
      }
    } else if (currentFiber.child !== null) {
      currentFiber = currentFiber.child;
    }
    const sibling = ((currentFiber: any): Fiber).sibling;
    if (sibling !== null) {
      currentFiber = sibling;
    } else {
      break;
    }
  }
  return domElements;
}

export function handleTouchHitSlop(eventFiber: Fiber, props: Props): void {
  let hitSlopElements = eventFiber.stateNode;

  if (hitSlopElements === null) {
    hitSlopElements = eventFiber.stateNode = new Map();
  }
  const childElements = getChildDomElementsFromFiber(eventFiber);

  for (let i = 0; i < childElements.length; i++) {
    const childElement = childElements[i];

    if (hitSlopElements.has(childElement)) {
      continue;
    }
    if (excludeElementsFromHitSlop.has(childElement.nodeName)) {
      warningWithoutStack(
        false,
        '<TouchHitTarget> encountered a child DOM element "%s". Cannot apply hit slop to this type of DOM element.',
        childElement.nodeName,
      );
      continue;
    }
    const hitSlopElement = childElement.ownerDocument.createElement('hit-slop');
    const childStyle = (childElement: any).style;
    const hitSlopElementStyle = (hitSlopElement: any).style;
    // TODO: making it relative might break things, maybe we should
    // check first?
    childStyle.position = 'relative';
    hitSlopElementStyle.position = 'absolute';
    hitSlopElementStyle.display = 'block';
    if (props.top) {
      hitSlopElementStyle.top = `-${props.top}px`;
    }
    if (props.left) {
      hitSlopElementStyle.left = `-${props.left}px`;
    }
    if (props.right) {
      hitSlopElementStyle.right = `-${props.right}px`;
    }
    if (props.bottom) {
      hitSlopElementStyle.bottom = `-${props.bottom}px`;
    }
    childElement.appendChild(hitSlopElement);
    hitSlopElements.set(childElement, hitSlopElement);
  }
}
