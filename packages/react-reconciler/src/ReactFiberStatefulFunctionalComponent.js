/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from './ReactFiber';
import type {ExpirationTime} from './ReactFiberExpirationTime';

import {enableAsyncSubtreeAPI} from 'shared/ReactFeatureFlags';
import emptyObject from 'fbjs/lib/emptyObject';
import * as ReactInstanceMap from 'shared/ReactInstanceMap';

import {AsyncUpdates} from './ReactTypeOfInternalContext';
import {
  cacheContext,
  getMaskedContext,
  getUnmaskedContext,
  isContextConsumer,
} from './ReactFiberContext';

function createInstance(state, context) {
  return {
    context,
    state,
    updater: null,
  };
}

export default function(
  scheduleWork: (fiber: Fiber, expirationTime: ExpirationTime) => void,
  computeExpirationForFiber: (fiber: Fiber) => ExpirationTime,
  memoizeProps: (workInProgress: Fiber, props: any) => void,
  memoizeState: (workInProgress: Fiber, state: any) => void,
) {

  function adoptFunctionalComponentInstance(workInProgress: Fiber, instance: any): void {
    workInProgress.stateNode = instance;
    // The instance needs access to the fiber so that it can schedule updates
    ReactInstanceMap.set(instance, workInProgress);
  }

  function createStatefulFunctionalComponent(workInProgress: Fiber, props: any) {
    const initialState = workInProgress.initialState;
    const unmaskedContext = getUnmaskedContext(workInProgress);
    const needsContext = isContextConsumer(workInProgress);
    const context = needsContext
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyObject;
    let state = emptyObject;
    if (typeof initialState === 'function') {
      // in DEV mode we ensure the "this" of getInitialState is null so
      // stateful functional components can't be used like class components
      if (__DEV__) {
        // eslint-disable-next-line
        state = initialState.call(null, props, context);
      } else {
        state = initialState(props, context);
      }
    }
    const instance = createInstance(state, context);
    adoptFunctionalComponentInstance(workInProgress, instance);

    // Cache unmasked context so we can avoid recreating masked context unless necessary.
    // ReactFiberContext usually updates this cache but can't for newly-created instances.
    if (needsContext) {
      cacheContext(workInProgress, unmaskedContext, context);
    }

    return instance;
  }

  function mountStatefulFunctionalComponent(
    workInProgress: Fiber,
    renderExpirationTime: ExpirationTime,
  ) {
    const current = workInProgress.alternate;
    const instance = workInProgress.stateNode;
    const state = instance.state || null;
    const props = workInProgress.pendingProps;
    const unmaskedContext = getUnmaskedContext(workInProgress);
    const type = workInProgress.type;
    const willMountFunc = type.willMountFunc;

    instance.state = workInProgress.memoizedState = state;
    instance.context = getMaskedContext(workInProgress, unmaskedContext);

    if (enableAsyncSubtreeAPI) {
      workInProgress.internalContextTag |= AsyncUpdates;
    }

    if (willMountFunc === 'function') {
      if (__DEV__) {
        // eslint-disable-next-line
        shouldUpdate = willMountFunc.call(null, props, state, reduce, context);
      } else {
        shouldUpdate = willMountFunc(props, state, reduce, context);
      }
    }
  }
  }

  function updateStatefulFunctionalComponent(
    current: Fiber,
    workInProgress: Fiber,
    renderExpirationTime: ExpirationTime,
  ) {
    const instance = workInProgress.stateNode;
    const type = workInProgress.type;
    const oldProps = workInProgress.memoizedProps;
    const oldContext = instance.context;
    const oldState = workInProgress.memoizedState;
    let newProps = workInProgress.pendingProps;
    const shouldUpdateFunc = type.shouldUpdate;
    let shouldUpdate = true;

    if (shouldUpdateFunc === 'function') {
      if (__DEV__) {
        // eslint-disable-next-line
        shouldUpdate = shouldUpdateFunc.call(null, oldProps, newProps, oldState, newState);
      } else {
        shouldUpdate = shouldUpdateFunc(oldProps, newProps, oldState, newState);
      }
    }
  }

  return {
    createStatefulFunctionalComponent,
    mountStatefulFunctionalComponent,
    updateStatefulFunctionalComponent,
  };
}
