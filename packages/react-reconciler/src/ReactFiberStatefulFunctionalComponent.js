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

import {Update} from 'shared/ReactTypeOfSideEffect';
import {enableAsyncSubtreeAPI} from 'shared/ReactFeatureFlags';
import emptyObject from 'fbjs/lib/emptyObject';
import * as ReactInstanceMap from 'shared/ReactInstanceMap';
import invariant from 'fbjs/lib/invariant';

import {startPhaseTimer, stopPhaseTimer} from './ReactDebugFiberPerf';
import {hasContextChanged} from './ReactFiberContext';
import {AsyncUpdates} from './ReactTypeOfInternalContext';
import {
  cacheContext,
  getMaskedContext,
  getUnmaskedContext,
  isContextConsumer,
} from './ReactFiberContext';
import {
  insertUpdateIntoFiber,
  processUpdateQueue,
} from './ReactFiberUpdateQueue';

export type StatefulFunctionalComponent = {|
  context: Object,
  state: Object,
  _reactInternalFiber: Fiber | null,
  reduceFunc: Function | null,
  setStateFunc: Function | null,
|}

function createInstance(state, context, reduceFunc): StatefulFunctionalComponent {
  return {
    context,
    state,
    _reactInternalFiber: null,
    reduceFunc: null,
    setStateFunc: null,
  };
}

export default function(
  scheduleWork: (fiber: Fiber, expirationTime: ExpirationTime) => void,
  computeExpirationForFiber: (fiber: Fiber) => ExpirationTime,
  memoizeProps: (workInProgress: Fiber, props: any) => void,
  memoizeState: (workInProgress: Fiber, state: any) => void,
) {

  function reduceFunc(instance, _reducerFunc, action, callback) {
    const fiber = ReactInstanceMap.get(instance);
    callback = callback === undefined ? null : callback;
    const expirationTime = computeExpirationForFiber(fiber);
    const update = {
      action,
      expirationTime,
      partialState: _reducerFunc,
      callback,
      isReplace: false,
      isForced: false,
      nextCallback: null,
      next: null,
    };
    insertUpdateIntoFiber(fiber, update);
    scheduleWork(fiber, expirationTime);
  }

  function setStateFunc(instance, partialState, callback) {
    const fiber = ReactInstanceMap.get(instance);
    callback = callback === undefined ? null : callback;
    const expirationTime = computeExpirationForFiber(fiber);
    const update = {
      action: null,
      expirationTime,
      partialState,
      callback,
      isReplace: false,
      isForced: false,
      nextCallback: null,
      next: null,
    };
    insertUpdateIntoFiber(fiber, update);
    scheduleWork(fiber, expirationTime);
  }

  function adoptFunctionalComponentInstance(workInProgress: Fiber, instance: any): void {
    workInProgress.stateNode = instance;
    // The instance needs access to the fiber so that it can schedule updates
    ReactInstanceMap.set(instance, workInProgress);
  }

  function createStatefulFunctionalComponent(workInProgress: Fiber, props: any) {
    const type = workInProgress.type;
    const initialStateFunc = type.initialState;
    const unmaskedContext = getUnmaskedContext(workInProgress);
    const needsContext = isContextConsumer(workInProgress);
    const context = needsContext
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyObject;
    let state = emptyObject;
    if (typeof initialStateFunc === 'function') {
      // in DEV mode we ensure the "this" of getInitialState is null so
      // stateful functional components can't be used like class components
      if (__DEV__) {
        // eslint-disable-next-line
        state = initialStateFunc.call(null, props, context);
      } else {
        state = initialStateFunc(props, context);
      }
    }
    const instance = createInstance(state, context);
    instance.reduceFunc = reduceFunc.bind(null, instance, type.reducer);
    instance.setStateFunc = setStateFunc.bind(null, instance);
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
    const didMountFunc = type.didMountFunc;

    instance.state = workInProgress.memoizedState = state;
    instance.context = getMaskedContext(workInProgress, unmaskedContext);

    if (enableAsyncSubtreeAPI) {
      workInProgress.internalContextTag |= AsyncUpdates;
    }
    if (willMountFunc === 'function') {
      if (__DEV__) {
        // eslint-disable-next-line
        willMountFunc.call(undefined, props, state);
      } else {
        willMountFunc(props, state);
      }
      // If we had additional state updates during this life-cycle, let's
      // process them now.
      const updateQueue = workInProgress.updateQueue;
      if (updateQueue !== null) {
        instance.state = processUpdateQueue(
          current,
          workInProgress,
          updateQueue,
          instance,
          props,
          renderExpirationTime,
        );
      }
    }
    if (typeof didMountFunc === 'function') {
      workInProgress.effectTag |= Update;
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
    let newProps = workInProgress.pendingProps;
    
    if (!newProps) {
      // If there aren't any new props, then we'll reuse the memoized props.
      // This could be from already completed work.
      newProps = oldProps;
      invariant(
        newProps != null,
        'There should always be pending or memoized props. This error is ' +
          'likely caused by a bug in React. Please file an issue.',
      );
    }
    const oldContext = instance.context;
    const newUnmaskedContext = getUnmaskedContext(workInProgress);
    const newContext = getMaskedContext(workInProgress, newUnmaskedContext);

    // Note: During these life-cycles, instance.props/instance.state are what
    // ever the previously attempted to render - not the "current". However,
    // during componentDidUpdate we pass the "current" props.
    const willReceivePropsFunc = type.willReceiveProps;
    const oldState = instance.state = workInProgress.memoizedState;

    if (
      typeof willReceivePropsFunc === 'function' &&
      (oldProps !== newProps || oldContext !== newContext)
    ) {
      if (__DEV__) {
        // eslint-disable-next-line
        willReceivePropsFunc.call(undefined, oldProps, oldState, {
          nextProps: newProps,
          reduce: instance.reduceFunc,
          setState: instance.setStateFunc,
        });
      } else {
        willReceivePropsFunc({
          nextProps: newProps,
          reduce: instance.reduceFunc,
          setState: instance.setStateFunc,
        });
      }
    }
    // Compute the next state using the memoized state and the update queue.
    // TODO: Previous state can be null.
    let newState;
    if (workInProgress.updateQueue !== null) {
      newState = processUpdateQueue(
        current,
        workInProgress,
        workInProgress.updateQueue,
        instance,
        newProps,
        renderExpirationTime,
      );
    } else {
      newState = oldState;
    }

    if (
      oldProps === newProps &&
      oldState === newState &&
      !hasContextChanged() &&
      !(
        workInProgress.updateQueue !== null &&
        workInProgress.updateQueue.hasForceUpdate
      )
    ) {
      // If an update was already in progress, we should schedule an Update
      // effect even though we're bailing out, so that cWU/cDU are called.
      if (typeof instance.componentDidUpdate === 'function') {
        if (
          oldProps !== current.memoizedProps ||
          oldState !== current.memoizedState
        ) {
          workInProgress.effectTag |= Update;
        }
      }
      return false;
    }

    const shouldUpdateFunc = type.shouldUpdate;
    let shouldUpdate = true;
    const config = {
      context: oldContext,
      nextState: newState,
      nextProps: newProps,
    };
    if (shouldUpdateFunc === 'function') {
      if (__DEV__) {
        // eslint-disable-next-line
        shouldUpdate = shouldUpdateFunc.call(null, oldProps, oldState, config);
      } else {
        shouldUpdate = shouldUpdateFunc(oldProps, oldState, config);
      }
    }
    if (shouldUpdate) {
      const willUpdateFunc = type.willUpdate;
      if (typeof willUpdateFunc === 'function') {
        startPhaseTimer(workInProgress, 'willUpdate');
        if (__DEV__) {
          // eslint-disable-next-line
          willUpdateFunc.call(null, oldProps, oldState, config);
        } else {
          willUpdateFunc(oldProps, oldState, config);
        }
        stopPhaseTimer();
        workInProgress.effectTag |= Update;
      }
    } else {
      const didUpdateFunc = type.didUpdate;
      // If an update was already in progress, we should schedule an Update
      // effect even though we're bailing out, so that cWU/cDU are called.
      if (typeof didUpdateFunc === 'function') {
        if (
          oldProps !== current.memoizedProps ||
          oldState !== current.memoizedState
        ) {
          workInProgress.effectTag |= Update;
        }
      }

      // If shouldComponentUpdate returned false, we should still update the
      // memoized props/state to indicate that this work can be reused.
      memoizeProps(workInProgress, newProps);
      memoizeState(workInProgress, newState);
    }
    // Update the existing instance's state, props, and context pointers even
    // if shouldComponentUpdate returns false.
    instance.state = newState;
    instance.context = newContext;

    return shouldUpdate;
  }

  return {
    createStatefulFunctionalComponent,
    mountStatefulFunctionalComponent,
    updateStatefulFunctionalComponent,
  };
}

