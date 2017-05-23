const emptyObject = {};
const ReactInstanceMap = new Map();
const enableAsyncSubtreeAPI = false;
const useSyncScheduling = true;
const logTopLevelRenders = true;

const IndeterminateComponent = 0; // Before we know whether it is functional or class
const FunctionalComponent = 1;
const ClassComponent = 2;
const HostRoot = 3; // Root of a host tree. Could be nested inside another node.
const HostPortal = 4; // A subtree. Could be an entry point to a different renderer.
const HostComponent = 5;
const HostText = 6;
const CoroutineComponent = 7;
const CoroutineHandlerPhase = 8;
const YieldComponent = 9;
const Fragment = 10;

const NoContext = 0;
const AsyncUpdates = 1;

const NoWork = 0; // No work is pending.
const SynchronousPriority = 1; // For controlled text inputs. Synchronous side-effects.
const TaskPriority = 2; // Completes at the end of the current tick.
const AnimationPriority = 3; // Needs to complete before the next frame.
const HighPriority = 4; // Interaction that needs to complete pretty soon to feel responsive.
const LowPriority = 5; // Data fetching, or result from updating stores.
const OffscreenPriority = 6; // Won't be visible but do the work in case it becomes visible.

const NoEffect = 0; //           0b0000000
const Placement = 1; //          0b0000001
const Update = 2; //             0b0000010
const PlacementAndUpdate = 3; // 0b0000011
const Deletion = 4; //           0b0000100
const ContentReset = 8; //       0b0001000
const Callback = 16; //          0b0010000
const Err = 32; //               0b0100000
const Ref = 64; //               0b1000000

let currentOwner;
const timeHeuristicForUnitOfWork = 1;

// The priority level to use when scheduling an update. We use NoWork to
// represent the default priority.
// TODO: Should we change this to an array instead of using the call stack?
// Might be less confusing.
let priorityContext: PriorityLevel = NoWork;

// Keep track of this so we can reset the priority context if an error
// is thrown during reconciliation.
let priorityContextBeforeReconciliation: PriorityLevel = NoWork;

// Keeps track of whether we're currently in a work loop.
let isPerformingWork: boolean = false;

// Keeps track of whether the current deadline has expired.
let deadlineHasExpired: boolean = false;

// Keeps track of whether we should should batch sync updates.
let isBatchingUpdates: boolean = false;

// The next work in progress fiber that we're currently working on.
let nextUnitOfWork: Fiber | null = null;
let nextPriorityLevel: PriorityLevel = NoWork;

// The next fiber with an effect that we're currently committing.
let nextEffect: Fiber | null = null;

let pendingCommit: Fiber | null = null;

// Linked list of roots with scheduled work on them.
let nextScheduledRoot: FiberRoot | null = null;
let lastScheduledRoot: FiberRoot | null = null;

// Keep track of which host environment callbacks are scheduled.
let isAnimationCallbackScheduled: boolean = false;
let isDeferredCallbackScheduled: boolean = false;

// Keep track of which fibers have captured an error that need to be handled.
// Work is removed from this collection after unstable_handleError is called.
let capturedErrors: Map<Fiber, CapturedError> | null = null;
// Keep track of which fibers have failed during the current batch of work.
// This is a different set than capturedErrors, because it is not reset until
// the end of the batch. This is needed to propagate errors correctly if a
// subtree fails more than once.
let failedBoundaries: Set<Fiber> | null = null;
// Error boundaries that captured an error during the current commit.
let commitPhaseBoundaries: Set<Fiber> | null = null;
let firstUncaughtError: Error | null = null;
let fatalError: Error | null = null;

let isCommitting: boolean = false;
let isUnmounting: boolean = false;

// A cursor to the current merged context object on the stack.
let contextStackCursor: StackCursor<Object> = createCursor(emptyObject);
// A cursor to a boolean indicating whether the context has changed.
let didPerformWorkStackCursor: StackCursor<boolean> = createCursor(false);
// Keep track of the previous context object that was on the stack.
// We use this to get access to the parent context after we have already
// pushed the next context provider, and now need to merge their contexts.
let previousContext: Object = emptyObject;

declare class NoContextT {}
const NO_CONTEXT: NoContextT = ({}: any);

type StackCursor<T> = {
  current: T,
};
const valueStack: Array<any> = [];
let index = -1;

let contextStackCursor: StackCursor<CX | NoContextT> = createCursor(
  NO_CONTEXT,
);
let contextFiberStackCursor: StackCursor<Fiber | NoContextT> = createCursor(
  NO_CONTEXT,
);
let rootInstanceStackCursor: StackCursor<C | NoContextT> = createCursor(
  NO_CONTEXT,
);

// START DOM Lite Renderer
function createContainer(container) {

}

function unbatchedUpdates() {

}

function hostScheduleAnimationCallback() {

}

function hostScheduleDeferredCallback() {

}

function prepareForCommit() {

}

function resetTextContent() {

}

function resetAfterCommit() {

}
// END DOM Lite Renderer

 function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  };
}

function isFailedBoundary(fiber: Fiber): boolean {
  // TODO: failedBoundaries should store the boundary instance, to avoid
  // needing to check the alternate.
  return (
    failedBoundaries !== null &&
    (failedBoundaries.has(fiber) ||
      (fiber.alternate !== null && failedBoundaries.has(fiber.alternate)))
  );
}

function scheduleErrorRecovery(fiber: Fiber) {
  scheduleUpdate(fiber, TaskPriority);
}

// Returns the boundary that captured the error, or null if the error is ignored
function captureError(failedWork: Fiber, error: Error): Fiber | null {
  // It is no longer valid because we exited the user code.
  currentOwner = null;
  // It is no longer valid because this unit of work failed.
  nextUnitOfWork = null;

  // Search for the nearest error boundary.
  let boundary: Fiber | null = null;

  // Passed to logCapturedError()
  let errorBoundaryFound: boolean = false;
  let willRetry: boolean = false;
  let errorBoundaryName: string | null = null;

  // Host containers are a special case. If the failed work itself is a host
  // container, then it acts as its own boundary. In all other cases, we
  // ignore the work itself and only search through the parents.
  if (failedWork.tag === HostRoot) {
    boundary = failedWork;

    if (isFailedBoundary(failedWork)) {
      // If this root already failed, there must have been an error when
      // attempting to unmount it. This is a worst-case scenario and
      // should only be possible if there's a bug in the renderer.
      fatalError = error;
    }
  } else {
    let node = failedWork.return;
    while (node !== null && boundary === null) {
      if (node.tag === ClassComponent) {
        const instance = node.stateNode;
        if (typeof instance.unstable_handleError === 'function') {
          errorBoundaryFound = true;
          errorBoundaryName = ''; // REMOVED

          // Found an error boundary!
          boundary = node;
          willRetry = true;
        }
      } else if (node.tag === HostRoot) {
        // Treat the root like a no-op error boundary.
        boundary = node;
      }

      if (isFailedBoundary(node)) {
        // This boundary is already in a failed state.

        // If we're currently unmounting, that means this error was
        // thrown while unmounting a failed subtree. We should ignore
        // the error.
        if (isUnmounting) {
          return null;
        }

        // If we're in the commit phase, we should check to see if
        // this boundary already captured an error during this commit.
        // This case exists because multiple errors can be thrown during
        // a single commit without interruption.
        if (
          commitPhaseBoundaries !== null &&
          (commitPhaseBoundaries.has(node) ||
            (node.alternate !== null &&
              commitPhaseBoundaries.has(node.alternate)))
        ) {
          // If so, we should ignore this error.
          return null;
        }

        // The error should propagate to the next boundary -— we keep looking.
        boundary = null;
        willRetry = false;
      }

      node = node.return;
    }
  }

  if (boundary !== null) {
    // Add to the collection of failed boundaries. This lets us know that
    // subsequent errors in this subtree should propagate to the next boundary.
    if (failedBoundaries === null) {
      failedBoundaries = new Set();
    }
    failedBoundaries.add(boundary);

    // This method is unsafe outside of the begin and complete phases.
    // We might be in the commit phase when an error is captured.
    // The risk is that the return path from this Fiber may not be accurate.
    // That risk is acceptable given the benefit of providing users more context.
    const componentStack = ''; // REMOVED
    const componentName = ''; // REMOVED

    // Add to the collection of captured errors. This is stored as a global
    // map of errors and their component stack location keyed by the boundaries
    // that capture them. We mostly use this Map as a Set; it's a Map only to
    // avoid adding a field to Fiber to store the error.
    if (capturedErrors === null) {
      capturedErrors = new Map();
    }
    capturedErrors.set(boundary, {
      componentName,
      componentStack,
      error,
      errorBoundary: errorBoundaryFound ? boundary.stateNode : null,
      errorBoundaryFound,
      errorBoundaryName,
      willRetry,
    });

    // If we're in the commit phase, defer scheduling an update on the
    // boundary until after the commit is complete
    if (isCommitting) {
      if (commitPhaseBoundaries === null) {
        commitPhaseBoundaries = new Set();
      }
      commitPhaseBoundaries.add(boundary);
    } else {
      // Otherwise, schedule an update now.
      scheduleErrorRecovery(boundary);
    }
    return boundary;
  } else if (firstUncaughtError === null) {
    // If no boundary is found, we'll need to throw the error
    firstUncaughtError = error;
  }
  return null;
}

function isContextProvider(fiber: Fiber): boolean {
  return fiber.tag === ClassComponent && fiber.type.childContextTypes != null;
}

function findCurrentUnmaskedContext(fiber: Fiber): Object {
  let node: Fiber = fiber;
  while (node.tag !== HostRoot) {
    if (isContextProvider(node)) {
      return node.stateNode.__reactInternalMemoizedMergedChildContext;
    }
    const parent = node.return;
    node = parent;
  }
  return node.stateNode.context;
}

function processChildContext(
  fiber: Fiber,
  parentContext: Object,
  isReconciling: boolean,
): Object {
  const instance = fiber.stateNode;
  if (typeof instance.getChildContext !== 'function') {
    return parentContext;
  }
  const childContext = instance.getChildContext();
  return {...parentContext, ...childContext};
}

function getContextFiber(fiber: Fiber) {
  const parentContext = findCurrentUnmaskedContext(fiber);
  return isContextProvider(fiber)
    ? processChildContext(fiber, parentContext, false)
    : parentContext;
}

function getContextForSubtree(
  parentComponent: ?ReactComponent<any, any, any>,
): Object {
  if (!parentComponent) {
    return emptyObject;
  }

  const instance = ReactInstanceMap.get(parentComponent);
  if (typeof instance.tag === 'number') {
    return getContextFiber(instance);
  } else {
    return instance._processChildContext(instance._context);
  }
}

function getPriorityContext(
  fiber: Fiber,
  forceAsync: boolean,
): PriorityLevel {
  let priorityLevel = priorityContext;
  if (priorityLevel === NoWork) {
    if (
      !useSyncScheduling ||
      fiber.internalContextTag & AsyncUpdates ||
      forceAsync
    ) {
      priorityLevel = LowPriority;
    } else {
      priorityLevel = SynchronousPriority;
    }
  }
  // If we're in a batch, or if we're already performing work, downgrade sync
  // priority to task priority
  if (
    priorityLevel === SynchronousPriority &&
    (isPerformingWork || isBatchingUpdates)
  ) {
    return TaskPriority;
  }
  return priorityLevel;
}

// Ensures that a fiber has an update queue, creating a new one if needed.
// Returns the new or existing queue.
function ensureUpdateQueue(fiber: Fiber): UpdateQueue {
  if (fiber.updateQueue !== null) {
    // We already have an update queue.
    return fiber.updateQueue;
  }

  let queue;
  if (__DEV__) {
    queue = {
      first: null,
      last: null,
      hasForceUpdate: false,
      callbackList: null,
      isProcessing: false,
    };
  } else {
    queue = {
      first: null,
      last: null,
      hasForceUpdate: false,
      callbackList: null,
    };
  }

  fiber.updateQueue = queue;
  return queue;
}

function comparePriority(a: PriorityLevel, b: PriorityLevel): number {
  // When comparing update priorities, treat sync and Task work as equal.
  // TODO: Could we avoid the need for this by always coercing sync priority
  // to Task when scheduling an update?
  if (
    (a === TaskPriority || a === SynchronousPriority) &&
    (b === TaskPriority || b === SynchronousPriority)
  ) {
    return 0;
  }
  if (a === NoWork && b !== NoWork) {
    return -255;
  }
  if (a !== NoWork && b === NoWork) {
    return 255;
  }
  return a - b;
}

function insertUpdateIntoQueue(
  queue: UpdateQueue,
  update: Update,
  insertAfter: Update | null,
  insertBefore: Update | null,
) {
  if (insertAfter !== null) {
    insertAfter.next = update;
  } else {
    // This is the first item in the queue.
    update.next = queue.first;
    queue.first = update;
  }

  if (insertBefore !== null) {
    update.next = insertBefore;
  } else {
    // This is the last item in the queue.
    queue.last = update;
  }
}

// Returns the update after which the incoming update should be inserted into
// the queue, or null if it should be inserted at beginning.
function findInsertionPosition(queue, update): Update | null {
  const priorityLevel = update.priorityLevel;
  let insertAfter = null;
  let insertBefore = null;
  if (
    queue.last !== null &&
    comparePriority(queue.last.priorityLevel, priorityLevel) <= 0
  ) {
    // Fast path for the common case where the update should be inserted at
    // the end of the queue.
    insertAfter = queue.last;
  } else {
    insertBefore = queue.first;
    while (
      insertBefore !== null &&
      comparePriority(insertBefore.priorityLevel, priorityLevel) <= 0
    ) {
      insertAfter = insertBefore;
      insertBefore = insertBefore.next;
    }
  }
  return insertAfter;
}

function cloneUpdate(update: Update): Update {
  return {
    priorityLevel: update.priorityLevel,
    partialState: update.partialState,
    callback: update.callback,
    isReplace: update.isReplace,
    isForced: update.isForced,
    isTopLevelUnmount: update.isTopLevelUnmount,
    next: null,
  };
}

function insertUpdate(fiber: Fiber, update: Update): Update | null {
  const queue1 = ensureUpdateQueue(fiber);
  const queue2 = fiber.alternate !== null
    ? ensureUpdateQueue(fiber.alternate)
    : null;

  // Find the insertion position in the first queue.
  const insertAfter1 = findInsertionPosition(queue1, update);
  const insertBefore1 = insertAfter1 !== null
    ? insertAfter1.next
    : queue1.first;

  if (queue2 === null) {
    // If there's no alternate queue, there's nothing else to do but insert.
    insertUpdateIntoQueue(queue1, update, insertAfter1, insertBefore1);
    return null;
  }

  // If there is an alternate queue, find the insertion position.
  const insertAfter2 = findInsertionPosition(queue2, update);
  const insertBefore2 = insertAfter2 !== null
    ? insertAfter2.next
    : queue2.first;

  // Now we can insert into the first queue. This must come after finding both
  // insertion positions because it mutates the list.
  insertUpdateIntoQueue(queue1, update, insertAfter1, insertBefore1);

  if (insertBefore1 !== insertBefore2) {
    // The insertion positions are different, so we need to clone the update and
    // insert the clone into the alternate queue.
    const update2 = cloneUpdate(update);
    insertUpdateIntoQueue(queue2, update2, insertAfter2, insertBefore2);
    return update2;
  } else {
    // The insertion positions are the same, so when we inserted into the first
    // queue, it also inserted into the alternate. All we need to do is update
    // the alternate queue's `first` and `last` pointers, in case they
    // have changed.
    if (insertAfter2 === null) {
      queue2.first = update;
    }
    if (insertBefore2 === null) {
      queue2.last = null;
    }
  }

  return null;
}

function addTopLevelUpdate(
  fiber: Fiber,
  partialState: PartialState<any, any>,
  callback: Callback | null,
  priorityLevel: PriorityLevel,
): void {
  const isTopLevelUnmount = partialState.element === null;

  const update = {
    priorityLevel,
    partialState,
    callback,
    isReplace: false,
    isForced: false,
    isTopLevelUnmount,
    next: null,
  };
  const update2 = insertUpdate(fiber, update);

  if (isTopLevelUnmount) {
    // Drop all updates that are lower-priority, so that the tree is not
    // remounted. We need to do this for both queues.
    const queue1 = fiber.updateQueue;
    const queue2 = fiber.alternate !== null
      ? fiber.alternate.updateQueue
      : null;

    if (queue1 !== null && update.next !== null) {
      update.next = null;
      queue1.last = update;
    }
    if (queue2 !== null && update2 !== null && update2.next !== null) {
      update2.next = null;
      queue2.last = update;
    }
  }
}

function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    return;
  }
  cursor.current = valueStack[index];
  valueStack[index] = null;
  index--;
};

function popContextProvider(fiber: Fiber): void {
  if (!isContextProvider(fiber)) {
    return;
  }

  pop(didPerformWorkStackCursor, fiber);
  pop(contextStackCursor, fiber);
}

function popHostContext(fiber: Fiber): void {
  // Do not pop unless this Fiber provided the current context.
  // pushHostContext() only pushes Fibers that provide unique contexts.
  if (contextFiberStackCursor.current !== fiber) {
    return;
  }

  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
}

function unwindContexts(from: Fiber, to: Fiber) {
  let node = from;
  while (node !== null && node !== to && node.alternate !== to) {
    switch (node.tag) {
      case ClassComponent:
        popContextProvider(node);
        break;
      case HostComponent:
        popHostContext(node);
        break;
      case HostRoot:
        popHostContainer(node);
        break;
      case HostPortal:
        popHostContainer(node);
        break;
    }
    node = node.return;
  }
}

function scheduleRoot(root: FiberRoot, priorityLevel: PriorityLevel) {
  if (priorityLevel === NoWork) {
    return;
  }
  if (!root.isScheduled) {
    root.isScheduled = true;
    if (lastScheduledRoot) {
      // Schedule ourselves to the end.
      lastScheduledRoot.nextScheduledRoot = root;
      lastScheduledRoot = root;
    } else {
      // We're the only work scheduled.
      nextScheduledRoot = root;
      lastScheduledRoot = root;
    }
  }
}

function commitAllHostEffects() {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;
    if (effectTag & ContentReset) {
      resetTextContent(nextEffect.stateNode);
    }

    if (effectTag & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }

    // The following switch statement is only concerned about placement,
    // updates, and deletions. To avoid needing to add a case for every
    // possible bitmap value, we remove the secondary effects from the
    // effect tag and switch on that value.
    let primaryEffectTag = effectTag & ~(Callback | Err | ContentReset | Ref);
    switch (primaryEffectTag) {
      case Placement: {
        commitPlacement(nextEffect);
        // Clear the "placement" from effect tag so that we know that this is inserted, before
        // any life-cycles like componentDidMount gets called.
        // TODO: findDOMNode doesn't rely on this any more but isMounted
        // does and isMounted is deprecated anyway so we should be able
        // to kill this.
        nextEffect.effectTag &= ~Placement;
        break;
      }
      case PlacementAndUpdate: {
        // Placement
        commitPlacement(nextEffect);
        // Clear the "placement" from effect tag so that we know that this is inserted, before
        // any life-cycles like componentDidMount gets called.
        nextEffect.effectTag &= ~Placement;

        // Update
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Deletion: {
        isUnmounting = true;
        commitDeletion(nextEffect);
        isUnmounting = false;
        break;
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}

function commitAllLifeCycles() {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;

    // Use Task priority for lifecycle updates
    if (effectTag & (Update | Callback)) {
      const current = nextEffect.alternate;
      commitLifeCycles(current, nextEffect);
    }

    if (effectTag & Ref) {
      commitAttachRef(nextEffect);
    }

    if (effectTag & Err) {
      commitErrorHandling(nextEffect);
    }

    const next = nextEffect.nextEffect;
    // Ensure that we clean these up so that we don't accidentally keep them.
    // I'm not actually sure this matters because we can't reset firstEffect
    // and lastEffect since they're on every node, not just the effectful
    // ones. So we have to clean everything as we reuse nodes anyway.
    nextEffect.nextEffect = null;
    // Ensure that we reset the effectTag here so that we can rely on effect
    // tags to reason about the current life-cycle.
    nextEffect = next;
  }
}

function commitAllWork(finishedWork: Fiber) {
  // We keep track of this so that captureError can collect any boundaries
  // that capture an error during the commit phase. The reason these aren't
  // local to this function is because errors that occur during cWU are
  // captured elsewhere, to prevent the unmount from being interrupted.
  isCommitting = true;
  pendingCommit = null;
  const root: FiberRoot = (finishedWork.stateNode: any);
  // Reset this to null before calling lifecycles
  currentOwner = null;

  // Updates that occur during the commit phase should have Task priority
  const previousPriorityContext = priorityContext;
  priorityContext = TaskPriority;

  let firstEffect;
  if (finishedWork.effectTag !== NoEffect) {
    // A fiber's effect list consists only of its children, not itself. So if
    // the root has an effect, we need to add it to the end of the list. The
    // resulting list is the set that would belong to the root's parent, if
    // it had one; that is, all the effects in the tree including the root.
    if (finishedWork.lastEffect !== null) {
      finishedWork.lastEffect.nextEffect = finishedWork;
      firstEffect = finishedWork.firstEffect;
    } else {
      firstEffect = finishedWork;
    }
  } else {
    // There is no effect on the root.
    firstEffect = finishedWork.firstEffect;
  }

  const commitInfo = prepareForCommit();

  // Commit all the side-effects within a tree. We'll do this in two passes.
  // The first pass performs all the host insertions, updates, deletions and
  // ref unmounts.
  nextEffect = firstEffect;
  while (nextEffect !== null) {
    let error = null;
    try {
      commitAllHostEffects(finishedWork);
    } catch (e) {
      error = e;
    }
    if (error !== null) {
      captureError(nextEffect, error);
      // Clean-up
      if (nextEffect !== null) {
        nextEffect = nextEffect.nextEffect;
      }
    }
  }
  resetAfterCommit(commitInfo);

  // The work-in-progress tree is now the current tree. This must come after
  // the first pass of the commit phase, so that the previous tree is still
  // current during componentWillUnmount, but before the second pass, so that
  // the finished work is current during componentDidMount/Update.
  root.current = finishedWork;

  // In the second pass we'll perform all life-cycles and ref callbacks.
  // Life-cycles happen as a separate pass so that all placements, updates,
  // and deletions in the entire tree have already been invoked.
  // This pass also triggers any renderer-specific initial effects.
  nextEffect = firstEffect;
  while (nextEffect !== null) {
    let error = null;
    try {
      commitAllLifeCycles(finishedWork);
    } catch (e) {
      error = e;
    }
    if (error !== null) {
      captureError(nextEffect, error);
      if (nextEffect !== null) {
        nextEffect = nextEffect.nextEffect;
      }
    }
  }

  isCommitting = false;
  if (typeof onCommitRoot === 'function') {
    onCommitRoot(finishedWork.stateNode);
  }
  // If we caught any errors during this commit, schedule their boundaries
  // to update.
  if (commitPhaseBoundaries) {
    commitPhaseBoundaries.forEach(scheduleErrorRecovery);
    commitPhaseBoundaries = null;
  }

  priorityContext = previousPriorityContext;
}

// findNextUnitOfWork mutates the current priority context. It is reset after
// after the workLoop exits, so never call findNextUnitOfWork from outside
// the work loop.
function findNextUnitOfWork() {
  // Clear out roots with no more work on them, or if they have uncaught errors
  while (
    nextScheduledRoot !== null &&
    nextScheduledRoot.current.pendingWorkPriority === NoWork
  ) {
    // Unschedule this root.
    nextScheduledRoot.isScheduled = false;
    // Read the next pointer now.
    // We need to clear it in case this root gets scheduled again later.
    const next = nextScheduledRoot.nextScheduledRoot;
    nextScheduledRoot.nextScheduledRoot = null;
    // Exit if we cleared all the roots and there's no work to do.
    if (nextScheduledRoot === lastScheduledRoot) {
      nextScheduledRoot = null;
      lastScheduledRoot = null;
      nextPriorityLevel = NoWork;
      return null;
    }
    // Continue with the next root.
    // If there's no work on it, it will get unscheduled too.
    nextScheduledRoot = next;
  }

  let root = nextScheduledRoot;
  let highestPriorityRoot = null;
  let highestPriorityLevel = NoWork;
  while (root !== null) {
    if (
      root.current.pendingWorkPriority !== NoWork &&
      (highestPriorityLevel === NoWork ||
        highestPriorityLevel > root.current.pendingWorkPriority)
    ) {
      highestPriorityLevel = root.current.pendingWorkPriority;
      highestPriorityRoot = root;
    }
    // We didn't find anything to do in this root, so let's try the next one.
    root = root.nextScheduledRoot;
  }
  if (highestPriorityRoot !== null) {
    nextPriorityLevel = highestPriorityLevel;
    priorityContext = nextPriorityLevel;

    // Before we start any new work, let's make sure that we have a fresh
    // stack to work from.
    // TODO: This call is buried a bit too deep. It would be nice to have
    // a single point which happens right before any new work and
    // unfortunately this is it.
    resetContextStack();

    return cloneFiber(highestPriorityRoot.current, highestPriorityLevel);
  }

  nextPriorityLevel = NoWork;
  return null;
}

function clearErrors() {
  if (nextUnitOfWork === null) {
    nextUnitOfWork = findNextUnitOfWork();
  }
  // Keep performing work until there are no more errors
  while (
    capturedErrors !== null &&
    capturedErrors.size &&
    nextUnitOfWork !== null &&
    nextPriorityLevel !== NoWork &&
    nextPriorityLevel <= TaskPriority
  ) {
    if (hasCapturedError(nextUnitOfWork)) {
      // Use a forked version of performUnitOfWork
      nextUnitOfWork = performFailedUnitOfWork(nextUnitOfWork);
    } else {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }
    if (nextUnitOfWork === null) {
      // If performUnitOfWork returns null, that means we just committed
      // a root. Normally we'd need to clear any errors that were scheduled
      // during the commit phase. But we're already clearing errors, so
      // we can continue.
      nextUnitOfWork = findNextUnitOfWork();
    }
  }
}

function beginFailedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
) {
  // Add an error effect so we can handle the error during the commit phase
  workInProgress.effectTag |= Err;

  if (
    workInProgress.pendingWorkPriority === NoWork ||
    workInProgress.pendingWorkPriority > priorityLevel
  ) {
    return bailoutOnLowPriority(current, workInProgress);
  }

  // If we don't bail out, we're going be recomputing our children so we need
  // to drop our effect list.
  workInProgress.firstEffect = null;
  workInProgress.lastEffect = null;

  // Unmount the current children as if the component rendered null
  const nextChildren = null;
  reconcileChildren(current, workInProgress, nextChildren);

  if (workInProgress.tag === ClassComponent) {
    const instance = workInProgress.stateNode;
    workInProgress.memoizedProps = instance.props;
    workInProgress.memoizedState = instance.state;
    workInProgress.pendingProps = null;
  }

  return workInProgress.child;
}

function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
): Fiber | null {
  if (
    workInProgress.pendingWorkPriority === NoWork ||
    workInProgress.pendingWorkPriority > priorityLevel
  ) {
    return bailoutOnLowPriority(current, workInProgress);
  }

  // If we don't bail out, we're going be recomputing our children so we need
  // to drop our effect list.
  workInProgress.firstEffect = null;
  workInProgress.lastEffect = null;

  if (workInProgress.progressedPriority === priorityLevel) {
    // If we have progressed work on this priority level already, we can
    // proceed this that as the child.
    workInProgress.child = workInProgress.progressedChild;
  }

  switch (workInProgress.tag) {
    case IndeterminateComponent:
      return mountIndeterminateComponent(
        current,
        workInProgress,
        priorityLevel,
      );
    case FunctionalComponent:
      return updateFunctionalComponent(current, workInProgress);
    case ClassComponent:
      return updateClassComponent(current, workInProgress, priorityLevel);
    case HostRoot:
      return updateHostRoot(current, workInProgress, priorityLevel);
    case HostComponent:
      return updateHostComponent(current, workInProgress);
    case HostText:
      return updateHostText(current, workInProgress);
    case CoroutineHandlerPhase:
      // This is a restart. Reset the tag to the initial phase.
      workInProgress.tag = CoroutineComponent;
    // Intentionally fall through since this is now the same.
    case CoroutineComponent:
      return updateCoroutineComponent(current, workInProgress);
    case YieldComponent:
      // A yield component is just a placeholder, we can just run through the
      // next one immediately.
      return null;
    case HostPortal:
      return updatePortalComponent(current, workInProgress);
    case Fragment:
      return updateFragment(current, workInProgress);
  }
}

function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
): Fiber | null {
  switch (workInProgress.tag) {
    case FunctionalComponent:
      return null;
    case ClassComponent: {
      // We are leaving this subtree, so pop context if any.
      popContextProvider(workInProgress);
      return null;
    }
    case HostRoot: {
      // TODO: Pop the host container after #8607 lands.
      const fiberRoot = (workInProgress.stateNode: FiberRoot);
      if (fiberRoot.pendingContext) {
        fiberRoot.context = fiberRoot.pendingContext;
        fiberRoot.pendingContext = null;
      }
      return null;
    }
    case HostComponent: {
      popHostContext(workInProgress);
      const rootContainerInstance = getRootHostContainer();
      const type = workInProgress.type;
      const newProps = workInProgress.memoizedProps;
      if (current !== null && workInProgress.stateNode != null) {
        // If we have an alternate, that means this is an update and we need to
        // schedule a side-effect to do the updates.
        const oldProps = current.memoizedProps;
        // If we get updated because one of our children updated, we don't
        // have newProps so we'll have to reuse them.
        // TODO: Split the update API as separate for the props vs. children.
        // Even better would be if children weren't special cased at all tho.
        const instance: I = workInProgress.stateNode;
        const currentHostContext = getHostContext();
        const updatePayload = prepareUpdate(
          instance,
          type,
          oldProps,
          newProps,
          rootContainerInstance,
          currentHostContext,
        );

        // TODO: Type this specific to this type of component.
        workInProgress.updateQueue = (updatePayload: any);
        // If the update payload indicates that there is a change or if there
        // is a new ref we mark this as an update.
        if (updatePayload) {
          markUpdate(workInProgress);
        }
        if (current.ref !== workInProgress.ref) {
          markRef(workInProgress);
        }
      } else {
        if (!newProps) {
          // This can happen when we abort work.
          return null;
        }

        const currentHostContext = getHostContext();
        // TODO: Move createInstance to beginWork and keep it on a context
        // "stack" as the parent. Then append children as we go in beginWork
        // or completeWork depending on we want to add then top->down or
        // bottom->up. Top->down is faster in IE11.
        const instance = createInstance(
          type,
          newProps,
          rootContainerInstance,
          currentHostContext,
          workInProgress,
        );

        appendAllChildren(instance, workInProgress);

        // Certain renderers require commit-time effects for initial mount.
        // (eg DOM renderer supports auto-focus for certain elements).
        // Make sure such renderers get scheduled for later work.
        if (
          finalizeInitialChildren(
            instance,
            type,
            newProps,
            rootContainerInstance,
          )
        ) {
          markUpdate(workInProgress);
        }

        workInProgress.stateNode = instance;
        if (workInProgress.ref !== null) {
          // If there is a ref on a host node we need to schedule a callback
          markRef(workInProgress);
        }
      }
      return null;
    }
    case HostText: {
      let newText = workInProgress.memoizedProps;
      if (current && workInProgress.stateNode != null) {
        const oldText = current.memoizedProps;
        // If we have an alternate, that means this is an update and we need
        // to schedule a side-effect to do the updates.
        if (oldText !== newText) {
          markUpdate(workInProgress);
        }
      } else {
        if (typeof newText !== 'string') {
          // This can happen when we abort work.
          return null;
        }
        const rootContainerInstance = getRootHostContainer();
        const currentHostContext = getHostContext();
        const textInstance = createTextInstance(
          newText,
          rootContainerInstance,
          currentHostContext,
          workInProgress,
        );
        workInProgress.stateNode = textInstance;
      }
      return null;
    }
    case CoroutineComponent:
      return moveCoroutineToHandlerPhase(current, workInProgress);
    case CoroutineHandlerPhase:
      // Reset the tag to now be a first phase coroutine.
      workInProgress.tag = CoroutineComponent;
      return null;
    case YieldComponent:
      // Does nothing.
      return null;
    case Fragment:
      return null;
    case HostPortal:
      // TODO: Only mark this as an update if we have any pending callbacks.
      markUpdate(workInProgress);
      popHostContainer(workInProgress);
      return null;
    // Error cases
    case IndeterminateComponent:
      break;
  }
}

function completeUnitOfWork(workInProgress: Fiber): Fiber | null {
  while (true) {
    // The current, flushed, state of this fiber is the alternate.
    // Ideally nothing should rely on this, but relying on it here
    // means that we don't need an additional field on the work in
    // progress.
    const current = workInProgress.alternate;
    const next = completeWork(current, workInProgress);

    const returnFiber = workInProgress.return;
    const siblingFiber = workInProgress.sibling;

    resetWorkPriority(workInProgress);

    if (next !== null) {
      // If completing this work spawned new work, do that next. We'll come
      // back here again.
      return next;
    }

    if (returnFiber !== null) {
      // Append all the effects of the subtree and this fiber onto the effect
      // list of the parent. The completion order of the children affects the
      // side-effect order.
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = workInProgress.firstEffect;
      }
      if (workInProgress.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = workInProgress.firstEffect;
        }
        returnFiber.lastEffect = workInProgress.lastEffect;
      }

      // If this fiber had side-effects, we append it AFTER the children's
      // side-effects. We can perform certain side-effects earlier if
      // needed, by doing multiple passes over the effect list. We don't want
      // to schedule our own side-effect on our own list because if end up
      // reusing children we'll schedule this effect onto itself since we're
      // at the end.
      if (workInProgress.effectTag !== NoEffect) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = workInProgress;
        } else {
          returnFiber.firstEffect = workInProgress;
        }
        returnFiber.lastEffect = workInProgress;
      }
    }

    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      return siblingFiber;
    } else if (returnFiber !== null) {
      // If there's no more work in this returnFiber. Complete the returnFiber.
      workInProgress = returnFiber;
      continue;
    } else {
      // We've reached the root. Unless we're current performing deferred
      // work, we should commit the completed work immediately. If we are
      // performing deferred work, returning null indicates to the caller
      // that we just completed the root so they can handle that case correctly.
      if (nextPriorityLevel < HighPriority) {
        // Otherwise, we should commit immediately.
        commitAllWork(workInProgress);
      } else {
        pendingCommit = workInProgress;
      }
      return null;
    }
  }

  // Without this explicit null return Flow complains of invalid return type
  // TODO Remove the above while(true) loop
  // eslint-disable-next-line no-unreachable
  return null;
}

function performUnitOfWork(workInProgress: Fiber): Fiber | null {
  // The current, flushed, state of this fiber is the alternate.
  // Ideally nothing should rely on this, but relying on it here
  // means that we don't need an additional field on the work in
  // progress.
  const current = workInProgress.alternate;
  // See if beginning this work spawns more work.
  let next = beginWork(current, workInProgress, nextPriorityLevel);
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    next = completeUnitOfWork(workInProgress);
  }
  currentOwner = null;
  return next;
}

function workLoop(priorityLevel, deadline: Deadline | null) {
  // Clear any errors.
  clearErrors();

  if (nextUnitOfWork === null) {
    nextUnitOfWork = findNextUnitOfWork();
  }

  // If there's a deadline, and we're not performing Task work, perform work
  // using this loop that checks the deadline on every iteration.
  if (deadline !== null && priorityLevel > TaskPriority) {
    // The deferred work loop will run until there's no time left in
    // the current frame.
    while (nextUnitOfWork !== null && !deadlineHasExpired) {
      if (deadline.timeRemaining() > timeHeuristicForUnitOfWork) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        // In a deferred work batch, iff nextUnitOfWork returns null, we just
        // completed a root and a pendingCommit exists. Logically, we could
        // omit either of the checks in the following condition, but we need
        // both to satisfy Flow.
        if (nextUnitOfWork === null && pendingCommit !== null) {
          // If we have time, we should commit the work now.
          if (deadline.timeRemaining() > timeHeuristicForUnitOfWork) {
            commitAllWork(pendingCommit);
            nextUnitOfWork = findNextUnitOfWork();
            // Clear any errors that were scheduled during the commit phase.
            clearErrors();
          } else {
            deadlineHasExpired = true;
          }
          // Otherwise the root will committed in the next frame.
        }
      } else {
        deadlineHasExpired = true;
      }
    }
  } else {
    // If there's no deadline, or if we're performing Task work, use this loop
    // that doesn't check how much time is remaining. It will keep running
    // until we run out of work at this priority level.
    while (
      nextUnitOfWork !== null &&
      nextPriorityLevel !== NoWork &&
      nextPriorityLevel <= priorityLevel
    ) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
      if (nextUnitOfWork === null) {
        nextUnitOfWork = findNextUnitOfWork();
        // performUnitOfWork returned null, which means we just committed a
        // root. Clear any errors that were scheduled during the commit phase.
        clearErrors();
      }
    }
  }
}

function performWork(
  priorityLevel: PriorityLevel,
  deadline: Deadline | null,
) {
  isPerformingWork = true;
  const isPerformingDeferredWork = !!deadline;

  // This outer loop exists so that we can restart the work loop after
  // catching an error. It also lets us flush Task work at the end of a
  // deferred batch.
  while (priorityLevel !== NoWork && !fatalError) {
    // Before starting any work, check to see if there are any pending
    // commits from the previous frame.
    if (pendingCommit !== null && !deadlineHasExpired) {
      commitAllWork(pendingCommit);
    }

    // Nothing in performWork should be allowed to throw. All unsafe
    // operations must happen within workLoop, which is extracted to a
    // separate function so that it can be optimized by the JS engine.
    priorityContextBeforeReconciliation = priorityContext;
    let error = null;
    try {
      workLoop(priorityLevel, deadline);
    } catch (e) {
      error = e;
    }
    // Reset the priority context to its value before reconcilation.
    priorityContext = priorityContextBeforeReconciliation;

    if (error !== null) {
      // We caught an error during either the begin or complete phases.
      const failedWork = nextUnitOfWork;

      if (failedWork !== null) {
        // "Capture" the error by finding the nearest boundary. If there is no
        // error boundary, the nearest host container acts as one. If
        // captureError returns null, the error was intentionally ignored.
        const maybeBoundary = captureError(failedWork, error);
        if (maybeBoundary !== null) {
          const boundary = maybeBoundary;

          // Complete the boundary as if it rendered null. This will unmount
          // the failed tree.
          beginFailedWork(boundary.alternate, boundary, priorityLevel);

          // The next unit of work is now the boundary that captured the error.
          // Conceptually, we're unwinding the stack. We need to unwind the
          // context stack, too, from the failed work to the boundary that
          // captured the error.
          // TODO: If we set the memoized props in beginWork instead of
          // completeWork, rather than unwind the stack, we can just restart
          // from the root. Can't do that until then because without memoized
          // props, the nodes higher up in the tree will rerender unnecessarily.
          unwindContexts(failedWork, boundary);
          nextUnitOfWork = completeUnitOfWork(boundary);
        }
        // Continue performing work
        continue;
      } else if (fatalError === null) {
        // There is no current unit of work. This is a worst-case scenario
        // and should only be possible if there's a bug in the renderer, e.g.
        // inside resetAfterCommit.
        fatalError = error;
      }
    }

    // Stop performing work
    priorityLevel = NoWork;

    // If have we more work, and we're in a deferred batch, check to see
    // if the deadline has expired.
    if (
      nextPriorityLevel !== NoWork &&
      isPerformingDeferredWork &&
      !deadlineHasExpired
    ) {
      // We have more time to do work.
      priorityLevel = nextPriorityLevel;
      continue;
    }

    // There might be work left. Depending on the priority, we should
    // either perform it now or schedule a callback to perform it later.
    switch (nextPriorityLevel) {
      case SynchronousPriority:
      case TaskPriority:
        // Perform work immediately by switching the priority level
        // and continuing the loop.
        priorityLevel = nextPriorityLevel;
        break;
      case AnimationPriority:
        scheduleAnimationCallback(performAnimationWork);
        // Even though the next unit of work has animation priority, there
        // may still be deferred work left over as well. I think this is
        // only important for unit tests. In a real app, a deferred callback
        // would be scheduled during the next animation frame.
        scheduleDeferredCallback(performDeferredWork);
        break;
      case HighPriority:
      case LowPriority:
      case OffscreenPriority:
        scheduleDeferredCallback(performDeferredWork);
        break;
    }
  }

  const errorToThrow = fatalError || firstUncaughtError;

  // We're done performing work. Time to clean up.
  isPerformingWork = false;
  deadlineHasExpired = false;
  fatalError = null;
  firstUncaughtError = null;
  capturedErrors = null;
  failedBoundaries = null;

  // It's safe to throw any unhandled errors.
  if (errorToThrow !== null) {
    throw errorToThrow;
  }
}

function scheduleAnimationCallback(callback) {
  if (!isAnimationCallbackScheduled) {
    isAnimationCallbackScheduled = true;
    hostScheduleAnimationCallback(callback);
  }
}

function performAnimationWork() {
  isAnimationCallbackScheduled = false;
  performWork(AnimationPriority, null);
}

function scheduleDeferredCallback(callback) {
  if (!isDeferredCallbackScheduled) {
    isDeferredCallbackScheduled = true;
    hostScheduleDeferredCallback(callback);
  }
}

function performDeferredWork(deadline) {
  // We pass the lowest deferred priority here because it acts as a minimum.
  // Higher priorities will also be performed.
  isDeferredCallbackScheduled = false;
  performWork(OffscreenPriority, deadline);
}

function scheduleUpdate(fiber: Fiber, priorityLevel: PriorityLevel) {
  if (priorityLevel <= nextPriorityLevel) {
    // We must reset the current unit of work pointer so that we restart the
    // search from the root during the next tick, in case there is now higher
    // priority work somewhere earlier than before.
    nextUnitOfWork = null;
  }
  let node = fiber;
  let shouldContinue = true;
  while (node !== null && shouldContinue) {
    // Walk the parent path to the root and update each node's priority. Once
    // we reach a node whose priority matches (and whose alternate's priority
    // matches) we can exit safely knowing that the rest of the path is correct.
    shouldContinue = false;
    if (
      node.pendingWorkPriority === NoWork ||
      node.pendingWorkPriority > priorityLevel
    ) {
      // Priority did not match. Update and keep going.
      shouldContinue = true;
      node.pendingWorkPriority = priorityLevel;
    }
    if (node.alternate !== null) {
      if (
        node.alternate.pendingWorkPriority === NoWork ||
        node.alternate.pendingWorkPriority > priorityLevel
      ) {
        // Priority did not match. Update and keep going.
        shouldContinue = true;
        node.alternate.pendingWorkPriority = priorityLevel;
      }
    }
    if (node.return === null) {
      if (node.tag === HostRoot) {
        const root: FiberRoot = (node.stateNode: any);
        scheduleRoot(root, priorityLevel);
        // Depending on the priority level, either perform work now or
        // schedule a callback to perform work later.
        switch (priorityLevel) {
          case SynchronousPriority:
            performWork(SynchronousPriority, null);
            return;
          case TaskPriority:
            // TODO: If we're not already performing work, schedule a
            // deferred callback.
            return;
          case AnimationPriority:
            scheduleAnimationCallback(performAnimationWork);
            return;
          case HighPriority:
          case LowPriority:
          case OffscreenPriority:
            scheduleDeferredCallback(performDeferredWork);
            return;
        }
      } else {
        return;
      }
    }
    node = node.return;
  }
}

function scheduleTopLevelUpdate(
  current: Fiber,
  element: ReactNodeList,
  callback: ?Function,
) {
  // Check if the top-level element is an async wrapper component. If so, treat
  // updates to the root as async. This is a bit weird but lets us avoid a separate
  // `renderAsync` API.
  const forceAsync =
    enableAsyncSubtreeAPI &&
    element != null &&
    element.type != null &&
    (element.type: any).unstable_asyncUpdates === true;
  const priorityLevel = getPriorityContext(current, forceAsync);
  const nextState = {element};
  callback = callback === undefined ? null : callback;
  addTopLevelUpdate(current, nextState, callback, priorityLevel);
  scheduleUpdate(current, priorityLevel);
}

function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?ReactComponent<any, any, any>,
  callback: ?Function,
) {
  // TODO: If this is a nested container, this won't be the root.
  const current = container.current;
  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  scheduleTopLevelUpdate(current, element, callback);
}

function getPublicRootInstance(
  container: OpaqueRoot
): ReactComponent<any, any, any> | I | TI | null {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  return containerFiber.child.stateNode;
}

function renderSubtreeIntoContainer(
  parentComponent: ?ReactComponent<any, any, any>,
  children: ReactNodeList,
  containerNode: DOMContainerElement | Document,
  callback: ?Function,
) {
  let root = containerNode._reactRootContainer;
  if (!root) {
    // First clear any existing content.
    while (containerNode.lastChild) {
      containerNode.removeChild(containerNode.lastChild);
    }
    const newRoot = createContainer(containerNode);
    root = containerNode._reactRootContainer = newRoot;
    // Initial mount should not be batched.
    unbatchedUpdates(() => {
      updateContainer(children, newRoot, parentComponent, callback);
    });
  } else {
    updateContainer(children, root, parentComponent, callback);
  }
  return getPublicRootInstance(root);
}

function render(
  element: ReactElement<any>,
  container: DOMContainerElement,
  callback: ?Function,
) {
  return renderSubtreeIntoContainer(null, element, container, callback);
}

export default {
  render,
};
