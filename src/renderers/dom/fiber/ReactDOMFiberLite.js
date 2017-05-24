import shallowEqual from 'fbjs/lib/shallowEqual';

const emptyObject = {};
const ReactInstanceMap = new Map();
const enableAsyncSubtreeAPI = false;
const useSyncScheduling = true;
// const logTopLevelRenders = true;

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

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/* global Symbol */
const ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.
const REACT_ELEMENT_TYPE =
  (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.element')) ||
  0xeac7;
const REACT_PORTAL_TYPE =
  (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.portal')) ||
  0xeaca;

const MOUNTING = 1;
const MOUNTED = 2;
const UNMOUNTED = 3;

const isArray = Array.isArray;

let currentOwner;
const timeHeuristicForUnitOfWork = 1;

// The Symbol used to tag the special React types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
let REACT_COROUTINE_TYPE;
let REACT_YIELD_TYPE;
if (typeof Symbol === 'function' && Symbol.for) {
  REACT_COROUTINE_TYPE = Symbol.for('react.coroutine');
  REACT_YIELD_TYPE = Symbol.for('react.yield');
} else {
  REACT_COROUTINE_TYPE = 0xeac8;
  REACT_YIELD_TYPE = 0xeac9;
}

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
// let contextStackCursor: StackCursor<Object> = createCursor(emptyObject);
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

const randomKey = Math.random().toString(36).slice(2);
const internalInstanceKey = '__reactInternalInstance$' + randomKey;

function addUpdate(
  fiber: Fiber,
  partialState: PartialState<any, any> | null,
  callback: mixed,
  priorityLevel: PriorityLevel,
): void {
  const update = {
    priorityLevel,
    partialState,
    callback,
    isReplace: false,
    isForced: false,
    isTopLevelUnmount: false,
    next: null,
  };
  insertUpdate(fiber, update);
}

function addReplaceUpdate(
  fiber: Fiber,
  state: any | null,
  callback: Callback | null,
  priorityLevel: PriorityLevel,
): void {
  const update = {
    priorityLevel,
    partialState: state,
    callback,
    isReplace: true,
    isForced: false,
    isTopLevelUnmount: false,
    next: null,
  };
  insertUpdate(fiber, update);
}

function addForceUpdate(
  fiber: Fiber,
  callback: Callback | null,
  priorityLevel: PriorityLevel,
): void {
  const update = {
    priorityLevel,
    partialState: null,
    callback,
    isReplace: false,
    isForced: true,
    isTopLevelUnmount: false,
    next: null,
  };
  insertUpdate(fiber, update);
}

// Class component state updater
const updater = {
  isMounted,
  enqueueSetState(instance, partialState, callback) {
    const fiber = ReactInstanceMap.get(instance);
    const priorityLevel = getPriorityContext(fiber, false);
    callback = callback === undefined ? null : callback;
    addUpdate(fiber, partialState, callback, priorityLevel);
    scheduleUpdate(fiber, priorityLevel);
  },
  enqueueReplaceState(instance, state, callback) {
    const fiber = ReactInstanceMap.get(instance);
    const priorityLevel = getPriorityContext(fiber, false);
    callback = callback === undefined ? null : callback;
    addReplaceUpdate(fiber, state, callback, priorityLevel);
    scheduleUpdate(fiber, priorityLevel);
  },
  enqueueForceUpdate(instance, callback) {
    const fiber = ReactInstanceMap.get(instance);
    const priorityLevel = getPriorityContext(fiber, false);
    callback = callback === undefined ? null : callback;
    addForceUpdate(fiber, callback, priorityLevel);
    scheduleUpdate(fiber, priorityLevel);
  },
};

// START DOM Lite Renderer

function appendInitialChild(
  parentInstance: Instance,
  child: Instance | TextInstance,
): void {
  parentInstance.appendChild(child);
}

function diffProperties() {

}

function getChildHostContext(
  parentHostContext: HostContext,
  type: string,
): HostContext {
  const parentNamespace = ((parentHostContext: any): HostContextProd);
  return getChildNamespace(parentNamespace, type);
}

function prepareUpdate(
  domElement: Instance,
  type: string,
  oldProps: Props,
  newProps: Props,
  rootContainerInstance: Container,
  hostContext: HostContext,
): null | Array<mixed> {
  return diffProperties(
    domElement,
    type,
    oldProps,
    newProps,
    rootContainerInstance,
  );
}

function shouldSetTextContent(props: Props): boolean {
  return (
    typeof props.children === 'string' ||
    typeof props.children === 'number' ||
    (typeof props.dangerouslySetInnerHTML === 'object' &&
      props.dangerouslySetInnerHTML !== null &&
      typeof props.dangerouslySetInnerHTML.__html === 'string')
  );
}

function createElement(type, props, rootContainer, parentNamespace) {
  return document.createElement(type);
}

const isUnitlessNumber = {
  animationIterationCount: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridColumn: 1,
  fontWeight: 1,
  lineClamp: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1,
};

function setStyle(lastValue, nextValue, domElement) {
	const domStyle = domElement.style;

	if (typeof nextValue === 'string') {
		domStyle.cssText = nextValue;
		return;
	}

	for (const style in nextValue) {
		// do not add a hasOwnProperty check here, it affects performance
		const value = nextValue[style];

		if (typeof value !== 'number' || isUnitlessNumber.has(style)) {
			domStyle[style] = value;
		} else {
			domStyle[style] = value + 'px';
		}
	}

	if (lastValue != null) {
		for (const style in lastValue) {
			if (nextValue[style] == null) {
				domStyle[style] = '';
			}
		}
	}
}

function setProps(
  domElement: Element,
  tag: string,
  lastProps: Object,
  nextProps: Object,
  rootContainerElement: Element,  
) {
  const nextPropNames = Object.keys(nextProps);
  const nextPropsLength = nextPropNames.length;

  for (let i = 0; i < nextPropsLength; i++) {
    const propName = nextPropNames[i];
    const propValue = nextProps[propName];

    switch (propName) {
      case 'className':
        domElement.className = propValue;
        break;
      case 'children':
        if (typeof propValue === 'string' || typeof propValue === 'number') {
          domElement.textContent = propValue;
        }
        break;
      case 'style':
        setStyle(null, propValue, domElement);
        break;
      default:
        domElement.setAttribute(propName, propValue);
    }
  }
}

function createInstance(
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object,
): Instance {
  let parentNamespace: string = parentNamespace = ((hostContext: any): HostContextProd);
  const domElement: Instance = createElement(
    type,
    props,
    rootContainerInstance,
    parentNamespace,
  );
  precacheFiberNode(internalInstanceHandle, domElement);
  return domElement;
}

function shouldAutoFocusHostComponent(type: string, props: Props): boolean {
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      return !!props.autoFocus;
  }
  return false;
}

function shouldDeprioritizeSubtree(type: string, props: Props): boolean {
  return !!props.hidden;
}

function finalizeInitialChildren(
  domElement: Instance,
  type: string,
  props: Props,
  rootContainerInstance: Container,
): boolean {
  setProps(domElement, type, null, props, rootContainerInstance);
  return shouldAutoFocusHostComponent(type, props);
}

function hostScheduleAnimationCallback() {

}

function hostScheduleDeferredCallback() {

}

function prepareForCommit() {

}

function resetTextContent(domElement: Instance): void {
  domElement.textContent = '';
}

function resetAfterCommit() {

}

function commitMount(
  domElement: Instance,
  type: string,
  newProps: Props,
  internalInstanceHandle: Object,
): void {
  ((domElement: any):
    | HTMLButtonElement
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement).focus();
}

function commitUpdate(
  domElement: Instance,
  updatePayload: Array<mixed>,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object,
): void {
  // Update the props handle so that we know which props are the ones with
  // with current event handlers.
  // updateFiberProps(domElement, newProps);
  // Apply the diff to the DOM node.
  // updateProperties(domElement, updatePayload, type, oldProps, newProps);
}

// Assumes there is no parent namespace.
function getIntrinsicNamespace(type: string): string {
  switch (type) {
    case 'svg':
      return SVG_NAMESPACE;
    case 'math':
      return MATH_NAMESPACE;
    default:
      return HTML_NAMESPACE;
  }
}

function getChildNamespace(parentNamespace: string | null, type: string): string {
  if (parentNamespace == null || parentNamespace === HTML_NAMESPACE) {
    // No (or default) parent namespace: potential entry point.
    return getIntrinsicNamespace(type);
  }
  if (parentNamespace === SVG_NAMESPACE && type === 'foreignObject') {
    // We're leaving SVG.
    return HTML_NAMESPACE;
  }
  // By default, pass namespace below.
  return parentNamespace;
}

function getRootHostContext(rootContainerInstance: Container): HostContext {
  const ownNamespace = rootContainerInstance.namespaceURI || null;
  const type = rootContainerInstance.tagName;
  const namespace = getChildNamespace(ownNamespace, type);
  return namespace;
}

function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}

function createTextInstance(
  text: string,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object,
): TextInstance {
  var textNode: TextInstance = document.createTextNode(text);
  precacheFiberNode(internalInstanceHandle, textNode);
  return textNode;
}

function commitTextUpdate(
  textInstance: TextInstance,
  oldText: string,
  newText: string,
): void {
  textInstance.nodeValue = newText;
}

function appendChild(
  parentInstance: Instance | Container,
  child: Instance | TextInstance,
): void {
  parentInstance.appendChild(child);
}

function insertBefore(
  parentInstance: Instance | Container,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance,
): void {
  parentInstance.insertBefore(child, beforeChild);
}

function removeChild(
  parentInstance: Instance | Container,
  child: Instance | TextInstance,
): void {
  parentInstance.removeChild(child);
}

function getPublicInstance(instance) {
  return instance;
}

function requiredContext<Value>(c: Value | NoContextT): Value {
  return (c: any);
}

function getRootHostContainer(): C {
  const rootInstance = requiredContext(rootInstanceStackCursor.current);
  return rootInstance;
}
// END DOM Lite Renderer

// This wrapper function exists because I expect to clone the code in each path
// to be able to optimize each path individually by branching early. This needs
// a compiler or we can do it manually. Helpers that don't need this branching
// live outside of this function.
function ChildReconciler(shouldClone, shouldTrackSideEffects) {
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      // Noop.
      return;
    }
    if (!shouldClone) {
      // When we're reconciling in place we have a work in progress copy. We
      // actually want the current copy. If there is no current copy, then we
      // don't need to track deletion side-effects.
      if (childToDelete.alternate === null) {
        return;
      }
      childToDelete = childToDelete.alternate;
    }
    // Deletions are added in reversed order so we add it to the front.
    const last = returnFiber.progressedLastDeletion;
    if (last !== null) {
      last.nextEffect = childToDelete;
      returnFiber.progressedLastDeletion = childToDelete;
    } else {
      returnFiber.progressedFirstDeletion = returnFiber.progressedLastDeletion = childToDelete;
    }
    childToDelete.nextEffect = null;
    childToDelete.effectTag = Deletion;
  }

  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
  ): null {
    if (!shouldTrackSideEffects) {
      // Noop.
      return null;
    }

    // TODO: For the shouldClone case, this could be micro-optimized a bit by
    // assuming that after the first child we've already added everything.
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function mapRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber,
  ): Map<string | number, Fiber> {
    // Add the remaining children to a temporary map so that we can find them by
    // keys quickly. Implicit (null) keys get added to this set with their index
    // instead.
    const existingChildren: Map<string | number, Fiber> = new Map();

    let existingChild = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function useFiber(fiber: Fiber, priority: PriorityLevel): Fiber {
    // We currently set sibling to null and index to 0 here because it is easy
    // to forget to do before returning it. E.g. for the single child case.
    if (shouldClone) {
      const clone = cloneFiber(fiber, priority);
      clone.index = 0;
      clone.sibling = null;
      return clone;
    } else {
      // We override the pending priority even if it is higher, because if
      // we're reconciling at a lower priority that means that this was
      // down-prioritized.
      fiber.pendingWorkPriority = priority;
      fiber.effectTag = NoEffect;
      fiber.index = 0;
      fiber.sibling = null;
      return fiber;
    }
  }

  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number,
  ): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      // Noop.
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move.
        newFiber.effectTag = Placement;
        return lastPlacedIndex;
      } else {
        // This item can stay in place.
        return oldIndex;
      }
    } else {
      // This is an insertion.
      newFiber.effectTag = Placement;
      return lastPlacedIndex;
    }
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.effectTag = Placement;
    }
    return newFiber;
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    priority: PriorityLevel,
  ) {
    if (current === null || current.tag !== HostText) {
      // Insert
      const created = createFiberFromText(
        textContent,
        returnFiber.internalContextTag,
        priority,
      );
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, priority);
      existing.pendingProps = textContent;
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    priority: PriorityLevel,
  ): Fiber {
    if (current === null || current.type !== element.type) {
      // Insert
      const created = createFiberFromElement(
        element,
        returnFiber.internalContextTag,
        priority,
      );
      created.ref = coerceRef(current, element);
      created.return = returnFiber;
      return created;
    } else {
      // Move based on index
      const existing = useFiber(current, priority);
      existing.ref = coerceRef(current, element);
      existing.pendingProps = element.props;
      existing.return = returnFiber;
      if (__DEV__) {
        existing._debugSource = element._source;
        existing._debugOwner = element._owner;
      }
      return existing;
    }
  }

  function updateCoroutine(
    returnFiber: Fiber,
    current: Fiber | null,
    coroutine: ReactCoroutine,
    priority: PriorityLevel,
  ): Fiber {
    // TODO: Should this also compare handler to determine whether to reuse?
    if (current === null || current.tag !== CoroutineComponent) {
      // Insert
      const created = createFiberFromCoroutine(
        coroutine,
        returnFiber.internalContextTag,
        priority,
      );
      created.return = returnFiber;
      return created;
    } else {
      // Move based on index
      const existing = useFiber(current, priority);
      existing.pendingProps = coroutine;
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateYield(
    returnFiber: Fiber,
    current: Fiber | null,
    yieldNode: ReactYield,
    priority: PriorityLevel,
  ): Fiber {
    if (current === null || current.tag !== YieldComponent) {
      // Insert
      const created = createFiberFromYield(
        yieldNode,
        returnFiber.internalContextTag,
        priority,
      );
      created.type = yieldNode.value;
      created.return = returnFiber;
      return created;
    } else {
      // Move based on index
      const existing = useFiber(current, priority);
      existing.type = yieldNode.value;
      existing.return = returnFiber;
      return existing;
    }
  }

  function updatePortal(
    returnFiber: Fiber,
    current: Fiber | null,
    portal: ReactPortal,
    priority: PriorityLevel,
  ): Fiber {
    if (
      current === null ||
      current.tag !== HostPortal ||
      current.stateNode.containerInfo !== portal.containerInfo ||
      current.stateNode.implementation !== portal.implementation
    ) {
      // Insert
      const created = createFiberFromPortal(
        portal,
        returnFiber.internalContextTag,
        priority,
      );
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, priority);
      existing.pendingProps = portal.children || [];
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: Iterable<*>,
    priority: PriorityLevel,
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      // Insert
      const created = createFiberFromFragment(
        fragment,
        returnFiber.internalContextTag,
        priority,
      );
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, priority);
      existing.pendingProps = fragment;
      existing.return = returnFiber;
      return existing;
    }
  }

  function createChild(
    returnFiber: Fiber,
    newChild: any,
    priority: PriorityLevel,
  ): Fiber | null {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      const created = createFiberFromText(
        '' + newChild,
        returnFiber.internalContextTag,
        priority,
      );
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.internalContextTag,
            priority,
          );
          created.ref = coerceRef(null, newChild);
          created.return = returnFiber;
          return created;
        }

        case REACT_COROUTINE_TYPE: {
          const created = createFiberFromCoroutine(
            newChild,
            returnFiber.internalContextTag,
            priority,
          );
          created.return = returnFiber;
          return created;
        }

        case REACT_YIELD_TYPE: {
          const created = createFiberFromYield(
            newChild,
            returnFiber.internalContextTag,
            priority,
          );
          created.type = newChild.value;
          created.return = returnFiber;
          return created;
        }

        case REACT_PORTAL_TYPE: {
          const created = createFiberFromPortal(
            newChild,
            returnFiber.internalContextTag,
            priority,
          );
          created.return = returnFiber;
          return created;
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.internalContextTag,
          priority,
        );
        created.return = returnFiber;
        return created;
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }

    return null;
  }

  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    priority: PriorityLevel,
  ): Fiber | null {
    // Update the fiber if the keys match, otherwise return null.

    const key = oldFiber !== null ? oldFiber.key : null;

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      if (key !== null) {
        return null;
      }
      return updateTextNode(returnFiber, oldFiber, '' + newChild, priority);
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild, priority);
          } else {
            return null;
          }
        }

        case REACT_COROUTINE_TYPE: {
          if (newChild.key === key) {
            return updateCoroutine(returnFiber, oldFiber, newChild, priority);
          } else {
            return null;
          }
        }

        case REACT_YIELD_TYPE: {
          // Yields doesn't have keys. If the previous node is implicitly keyed
          // we can continue to replace it without aborting even if it is not a
          // yield.
          if (key === null) {
            return updateYield(returnFiber, oldFiber, newChild, priority);
          } else {
            return null;
          }
        }

        case REACT_PORTAL_TYPE: {
          if (newChild.key === key) {
            return updatePortal(returnFiber, oldFiber, newChild, priority);
          } else {
            return null;
          }
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        // Fragments doesn't have keys so if the previous key is implicit we can
        // update it.
        if (key !== null) {
          return null;
        }
        return updateFragment(returnFiber, oldFiber, newChild, priority);
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }

    return null;
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    priority: PriorityLevel,
  ): Fiber | null {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys, so we neither have to check the old nor
      // new node for the key. If both are text nodes, they match.
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, '' + newChild, priority);
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key,
            ) || null;
          return updateElement(returnFiber, matchedFiber, newChild, priority);
        }

        case REACT_COROUTINE_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key,
            ) || null;
          return updateCoroutine(returnFiber, matchedFiber, newChild, priority);
        }

        case REACT_YIELD_TYPE: {
          // Yields doesn't have keys, so we neither have to check the old nor
          // new node for the key. If both are yields, they match.
          const matchedFiber = existingChildren.get(newIdx) || null;
          return updateYield(returnFiber, matchedFiber, newChild, priority);
        }

        case REACT_PORTAL_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key,
            ) || null;
          return updatePortal(returnFiber, matchedFiber, newChild, priority);
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null;
        return updateFragment(returnFiber, matchedFiber, newChild, priority);
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }

    return null;
  }

  /**
   * Warns if there is a duplicate or missing key
   */
  function warnOnInvalidKey(
    child: mixed,
    knownKeys: Set<string> | null,
  ): Set<string> | null {
    return knownKeys;
  }

  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<*>,
    priority: PriorityLevel,
  ): Fiber | null {
    // This algorithm can't optimize by searching from boths ends since we
    // don't have backpointers on fibers. I'm trying to see how far we can get
    // with that model. If it ends up not being worth the tradeoffs, we can
    // add it later.

    // Even with a two ended optimization, we'd want to optimize for the case
    // where there are few changes and brute force the comparison instead of
    // going for the Map. It'd like to explore hitting that path first in
    // forward-only mode and only go for the Map once we notice that we need
    // lots of look ahead. This doesn't handle reversal as well as two ended
    // search but that's unusual. Besides, for the two ended optimization to
    // work on Iterables, we'd need to copy the whole set.

    // In this first iteration, we'll just live with hitting the bad case
    // (adding everything to a Map) in for every insert/move.

    // If you change this code, also update reconcileChildrenIterator() which
    // uses the same algorithm.

    if (__DEV__) {
      // First, validate keys.
      let knownKeys = null;
      for (let i = 0; i < newChildren.length; i++) {
        const child = newChildren[i];
        knownKeys = warnOnInvalidKey(child, knownKeys);
      }
    }

    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        priority,
      );
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber;
      } else {
        // TODO: Defer siblings if we're not at the right index for this slot.
        // I.e. if we had null values before, then we want to defer this
        // for each null value. However, we also don't want to call updateSlot
        // with the previous one.
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (newIdx === newChildren.length) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(
          returnFiber,
          newChildren[newIdx],
          priority,
        );
        if (!newFiber) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          // TODO: Move out of the loop. This only happens for the first run.
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // Keep scanning and use the map to restore deleted items as moves.
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        priority,
      );
      if (newFiber) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  function reconcileChildrenIterator(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildrenIterable: Iterable<*>,
    priority: PriorityLevel,
  ): Fiber | null {
    // This is the same implementation as reconcileChildrenArray(),
    // but using the iterator instead.

    const iteratorFn = getIteratorFn(newChildrenIterable);

    const newChildren = iteratorFn.call(newChildrenIterable);

    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    let step = newChildren.next();
    for (
      ;
      oldFiber !== null && !step.done;
      newIdx++, (step = newChildren.next())
    ) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(returnFiber, oldFiber, step.value, priority);
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (!oldFiber) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber;
      } else {
        // TODO: Defer siblings if we're not at the right index for this slot.
        // I.e. if we had null values before, then we want to defer this
        // for each null value. However, we also don't want to call updateSlot
        // with the previous one.
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (step.done) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; !step.done; newIdx++, (step = newChildren.next())) {
        const newFiber = createChild(returnFiber, step.value, priority);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          // TODO: Move out of the loop. This only happens for the first run.
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // Keep scanning and use the map to restore deleted items as moves.
    for (; !step.done; newIdx++, (step = newChildren.next())) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        step.value,
        priority,
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    priority: PriorityLevel,
  ): Fiber {
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      // We already have an existing node so let's just update it and delete
      // the rest.
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, priority);
      existing.pendingProps = textContent;
      existing.return = returnFiber;
      return existing;
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(
      textContent,
      returnFiber.internalContextTag,
      priority,
    );
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    priority: PriorityLevel,
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (child.type === element.type) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, priority);
          existing.ref = coerceRef(child, element);
          existing.pendingProps = element.props;
          existing.return = returnFiber;
          if (__DEV__) {
            existing._debugSource = element._source;
            existing._debugOwner = element._owner;
          }
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    const created = createFiberFromElement(
      element,
      returnFiber.internalContextTag,
      priority,
    );
    created.ref = coerceRef(currentFirstChild, element);
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleCoroutine(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    coroutine: ReactCoroutine,
    priority: PriorityLevel,
  ): Fiber {
    const key = coroutine.key;
    let child = currentFirstChild;
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (child.tag === CoroutineComponent) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, priority);
          existing.pendingProps = coroutine;
          existing.return = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    const created = createFiberFromCoroutine(
      coroutine,
      returnFiber.internalContextTag,
      priority,
    );
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleYield(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    yieldNode: ReactYield,
    priority: PriorityLevel,
  ): Fiber {
    // There's no need to check for keys on yields since they're stateless.
    let child = currentFirstChild;
    if (child !== null) {
      if (child.tag === YieldComponent) {
        deleteRemainingChildren(returnFiber, child.sibling);
        const existing = useFiber(child, priority);
        existing.type = yieldNode.value;
        existing.return = returnFiber;
        return existing;
      } else {
        deleteRemainingChildren(returnFiber, child);
      }
    }

    const created = createFiberFromYield(
      yieldNode,
      returnFiber.internalContextTag,
      priority,
    );
    created.type = yieldNode.value;
    created.return = returnFiber;
    return created;
  }

  function reconcileSinglePortal(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    portal: ReactPortal,
    priority: PriorityLevel,
  ): Fiber {
    const key = portal.key;
    let child = currentFirstChild;
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (
          child.tag === HostPortal &&
          child.stateNode.containerInfo === portal.containerInfo &&
          child.stateNode.implementation === portal.implementation
        ) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, priority);
          existing.pendingProps = portal.children || [];
          existing.return = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    const created = createFiberFromPortal(
      portal,
      returnFiber.internalContextTag,
      priority,
    );
    created.return = returnFiber;
    return created;
  }

  // This API will tag the children with the side-effect of the reconciliation
  // itself. They will be added to the side-effect list as we pass through the
  // children and the parent.
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    priority: PriorityLevel,
  ): Fiber | null {
    // This function is not recursive.
    // If the top level item is an array, we treat it as a set of children,
    // not as a fragment. Nested arrays on the other hand will be treated as
    // fragment nodes. Recursion happens at the normal flow.

    const disableNewFiberFeatures = disableNewFiberFeatures;

    // Handle object types
    const isObject = typeof newChild === 'object' && newChild !== null;
    if (isObject) {
      // Support only the subset of return types that Stack supports. Treat
      // everything else as empty, but log a warning.
      if (disableNewFiberFeatures) {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return placeSingleChild(
              reconcileSingleElement(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );

          case REACT_PORTAL_TYPE:
            return placeSingleChild(
              reconcileSinglePortal(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );
        }
      } else {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return placeSingleChild(
              reconcileSingleElement(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );

          case REACT_COROUTINE_TYPE:
            return placeSingleChild(
              reconcileSingleCoroutine(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );

          case REACT_YIELD_TYPE:
            return placeSingleChild(
              reconcileSingleYield(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );

          case REACT_PORTAL_TYPE:
            return placeSingleChild(
              reconcileSinglePortal(
                returnFiber,
                currentFirstChild,
                newChild,
                priority,
              ),
            );
        }
      }
    }

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          '' + newChild,
          priority,
        ),
      );
    }

    if (isArray(newChild)) {
      return reconcileChildrenArray(
        returnFiber,
        currentFirstChild,
        newChild,
        priority,
      );
    }

    if (getIteratorFn(newChild)) {
      return reconcileChildrenIterator(
        returnFiber,
        currentFirstChild,
        newChild,
        priority,
      );
    }

    if (isObject) {
      throwOnInvalidObjectType(returnFiber, newChild);
    }

    // Remaining cases are all treated as empty.
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

const reconcileChildFibers = ChildReconciler(true, true);
const reconcileChildFibersInPlace = ChildReconciler(false, true);
const mountChildFibersInPlace = ChildReconciler(false, false);

/**
 * Returns the iterator method function contained on the iterable object.
 *
 * Be sure to invoke the function with the iterable as context:
 *
 *     var iteratorFn = getIteratorFn(myIterable);
 *     if (iteratorFn) {
 *       var iterator = iteratorFn.call(myIterable);
 *       ...
 *     }
 *
 * @param {?object} maybeIterable
 * @return {?function}
 */
function getIteratorFn(maybeIterable: ?any): ?() => ?Iterator<*> {
  var iteratorFn =
    maybeIterable &&
    ((ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL]) ||
      maybeIterable[FAUX_ITERATOR_SYMBOL]);
  if (typeof iteratorFn === 'function') {
    return iteratorFn;
  }
}

function throwOnInvalidObjectType(returnFiber: Fiber, newChild: Object) {
  if (returnFiber.type !== 'textarea') {
  }
}

function isFiberMountedImpl(fiber: Fiber): number {
  let node = fiber;
  if (!fiber.alternate) {
    // If there is no alternate, this might be a new tree that isn't inserted
    // yet. If it is, then it will have a pending insertion effect on it.
    if ((node.effectTag & Placement) !== NoEffect) {
      return MOUNTING;
    }
    while (node.return) {
      node = node.return;
      if ((node.effectTag & Placement) !== NoEffect) {
        return MOUNTING;
      }
    }
  } else {
    while (node.return) {
      node = node.return;
    }
  }
  if (node.tag === HostRoot) {
    // TODO: Check if this was a nested HostRoot when used with
    // renderContainerIntoSubtree.
    return MOUNTED;
  }
  // If we didn't hit the root, that means that we're in an disconnected tree
  // that has been unmounted.
  return UNMOUNTED;
}

function isMounted(
  component: ReactComponent<any, any, any>,
): boolean {

  var fiber = ReactInstanceMap.get(component);
  if (!fiber) {
    return false;
  }
  return isFiberMountedImpl(fiber) === MOUNTED;
}

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

  const queue = {
    first: null,
    last: null,
    hasForceUpdate: false,
    callbackList: null,
  };

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
  _insertBefore: Update | null,
) {
  if (insertAfter !== null) {
    insertAfter.next = update;
  } else {
    // This is the first item in the queue.
    update.next = queue.first;
    queue.first = update;
  }

  if (_insertBefore !== null) {
    update.next = _insertBefore;
  } else {
    // This is the last item in the queue.
    queue.last = update;
  }
}

// Returns the update after which the incoming update should be inserted into
// the queue, or null if it should be inserted at beginning.
function findInsertionPosition(queue, update): Update | null {
  const priorityLevel = update.priorityLevel;
  let _insertAfter = null;
  let _insertBefore = null;
  if (
    queue.last !== null &&
    comparePriority(queue.last.priorityLevel, priorityLevel) <= 0
  ) {
    // Fast path for the common case where the update should be inserted at
    // the end of the queue.
    _insertAfter = queue.last;
  } else {
    _insertBefore = queue.first;
    while (
      _insertBefore !== null &&
      comparePriority(_insertBefore.priorityLevel, priorityLevel) <= 0
    ) {
      _insertAfter = _insertBefore;
      _insertBefore = _insertBefore.next;
    }
  }
  return _insertAfter;
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

function popHostContainer(fiber: Fiber) {
  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
  pop(rootInstanceStackCursor, fiber);
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

function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = getPublicInstance(finishedWork.stateNode);
    ref(instance);
  }
}

function commitDetachRef(current: Fiber) {
  const currentRef = current.ref;
  if (currentRef !== null) {
    currentRef(null);
  }
}

function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
}

function isHostParent(fiber: Fiber): boolean {
  return (
    fiber.tag === HostComponent ||
    fiber.tag === HostRoot ||
    fiber.tag === HostPortal
  );
}

function getHostSibling(fiber: Fiber): ?I {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node: Fiber = fiber;
  siblings: while (true) {
    // If we didn't find anything, let's try the next sibling.
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.effectTag & Placement) {
        // If we don't have a child, try the siblings instead.
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      if (node.child === null || node.tag === HostPortal) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.effectTag & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

function commitPlacement(finishedWork: Fiber): void {
  // Recursively insert all host nodes into the parent.
  const parentFiber = getHostParentFiber(finishedWork);
  let parent;
  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentFiber.stateNode;
      break;
    case HostRoot:
      parent = parentFiber.stateNode.containerInfo;
      break;
    case HostPortal:
      parent = parentFiber.stateNode.containerInfo;
      break;
  }
  if (parentFiber.effectTag & ContentReset) {
    // Reset the text content of the parent before doing any insertions
    resetTextContent(parent);
    // Clear ContentReset from the effect tag
    parentFiber.effectTag &= ~ContentReset;
  }

  const before = getHostSibling(finishedWork);
  // We only have the top Fiber that was inserted but we need recurse down its
  // children to find all the terminal nodes.
  let node: Fiber = finishedWork;
  while (true) {
    if (node.tag === HostComponent || node.tag === HostText) {
      if (before) {
        insertBefore(parent, node.stateNode, before);
      } else {
        appendChild(parent, node.stateNode);
      }
    } else if (node.tag === HostPortal) {
      // If the insertion itself is a portal, then we don't want to traverse
      // down its children. Instead, we'll get insertions from each child in
      // the portal directly.
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === finishedWork) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case ClassComponent: {
      return;
    }
    case HostComponent: {
      const instance: I = finishedWork.stateNode;
      if (instance != null && current !== null) {
        // Commit the work prepared earlier.
        const newProps = finishedWork.memoizedProps;
        const oldProps = current.memoizedProps;
        const type = finishedWork.type;
        // TODO: Type the updateQueue to be specific to host components.
        const updatePayload: null | PL = (finishedWork.updateQueue: any);
        finishedWork.updateQueue = null;
        if (updatePayload !== null) {
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork,
          );
        }
      }
      return;
    }
    case HostText: {
      const textInstance: TI = finishedWork.stateNode;
      const newText: string = finishedWork.memoizedProps;
      const oldText: string = current.memoizedProps;
      commitTextUpdate(textInstance, oldText, newText);
      return;
    }
    case HostRoot: {
      return;
    }
    case HostPortal: {
      return;
    }
    default: {
    }
  }
}

function reset(): void {
  while (index > -1) {
    valueStack[index] = null;
    index--;
  }
}

function resetContext(): void {
  previousContext = emptyObject;
  contextStackCursor.current = emptyObject;
  didPerformWorkStackCursor.current = false;
}

function resetHostContainer() {
  contextStackCursor.current = NO_CONTEXT;
  rootInstanceStackCursor.current = NO_CONTEXT;
}

function resetContextStack() {
  // Reset the stack
  reset();
  // Reset the cursors
  resetContext();
  resetHostContainer();
}

function getHostParent(fiber: Fiber): I | C {
  let parent = fiber.return;
  while (parent !== null) {
    switch (parent.tag) {
      case HostComponent:
        return parent.stateNode;
      case HostRoot:
        return parent.stateNode.containerInfo;
      case HostPortal:
        return parent.stateNode.containerInfo;
    }
    parent = parent.return;
  }
}

function safelyDetachRef(current: Fiber) {
  const ref = current.ref;
  if (ref !== null) {
    try {
      ref(null);
    } catch (refError) {
      captureError(current, refError);
    }
  }
}

// Capture errors so they don't interrupt unmounting.
function safelyCallComponentWillUnmount(current, instance) {
  try {
    instance.componentWillUnmount();
  } catch (unmountError) {
    captureError(current, unmountError);
  }
}

// User-originating errors (lifecycles and refs) should not interrupt
// deletion, so don't let them throw. Host-originating errors should
// interrupt deletion, so it's okay
function commitUnmount(current: Fiber): void {
  switch (current.tag) {
    case ClassComponent: {
      safelyDetachRef(current);
      const instance = current.stateNode;
      if (typeof instance.componentWillUnmount === 'function') {
        safelyCallComponentWillUnmount(current, instance);
      }
      return;
    }
    case HostComponent: {
      safelyDetachRef(current);
      return;
    }
    case CoroutineComponent: {
      commitNestedUnmounts(current.stateNode);
      return;
    }
    case HostPortal: {
      // TODO: this is recursive.
      // We are also not using this parent because
      // the portal will get pushed immediately.
      const parent = getHostParent(current);
      unmountHostComponents(parent, current);
      return;
    }
  }
}

function commitNestedUnmounts(root: Fiber): void {
  // While we're inside a removed host node we don't want to call
  // removeChild on the inner nodes because they're removed by the top
  // call anyway. We also want to call componentWillUnmount on all
  // composites before this host node is removed from the tree. Therefore
  // we do an inner loop while we're still inside the host node.
  let node: Fiber = root;
  while (true) {
    commitUnmount(node);
    // Visit children because they may contain more composite or host nodes.
    // Skip portals because commitUnmount() currently visits them recursively.
    if (node.child !== null && node.tag !== HostPortal) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function unmountHostComponents(parent, current): void {
  // We only have the top Fiber that was inserted but we need recurse down its
  // children to find all the terminal nodes.
  let node: Fiber = current;
  while (true) {
    if (node.tag === HostComponent || node.tag === HostText) {
      commitNestedUnmounts(node);
      // After all the children have unmounted, it is now safe to remove the
      // node from the tree.
      removeChild(parent, node.stateNode);
      // Don't visit children because we already visited them.
    } else if (node.tag === HostPortal) {
      // When we go into a portal, it becomes the parent to remove from.
      // We will reassign it back when we pop the portal on the way up.
      parent = node.stateNode.containerInfo;
      // Visit children because portals might contain host components.
      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    } else {
      commitUnmount(node);
      // Visit children because we may find more host components below.
      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    }
    if (node === current) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === current) {
        return;
      }
      node = node.return;
      if (node.tag === HostPortal) {
        // When we go out of the portal, we need to restore the parent.
        // Since we don't keep a stack of them, we will search for it.
        parent = getHostParent(node);
      }
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitDeletion(current: Fiber): void {
  // Recursively delete all host nodes from the parent.
  const parent = getHostParent(current);
  // Detach refs and call componentWillUnmount() on the whole subtree.
  unmountHostComponents(parent, current);

  // Cut off the return pointers to disconnect it from the tree. Ideally, we
  // should clear the child pointer of the parent alternate to let this
  // get GC:ed but we don't know which for sure which parent is the current
  // one so we'll settle for GC:ing the subtree of this child. This child
  // itself will be GC:ed when the parent updates the next time.
  current.return = null;
  current.child = null;
  if (current.alternate) {
    current.alternate.child = null;
    current.alternate.return = null;
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

function logCapturedError() {

}

function commitErrorHandling(effectfulFiber: Fiber) {
  let capturedError;
  if (capturedErrors !== null) {
    capturedError = capturedErrors.get(effectfulFiber);
    capturedErrors.delete(effectfulFiber);
    if (capturedError == null) {
      if (effectfulFiber.alternate !== null) {
        effectfulFiber = effectfulFiber.alternate;
        capturedError = capturedErrors.get(effectfulFiber);
        capturedErrors.delete(effectfulFiber);
      }
    }
  }

  const error = capturedError.error;
  try {
    logCapturedError(capturedError);
  } catch (e) {
    // Prevent cycle if logCapturedError() throws.
    // A cycle may still occur if logCapturedError renders a component that throws.
    console.error(e);
  }

  switch (effectfulFiber.tag) {
    case ClassComponent:
      const instance = effectfulFiber.stateNode;

      const info: HandleErrorInfo = {
        componentStack: capturedError.componentStack,
      };

      // Allow the boundary to handle the error, usually by scheduling
      // an update to itself
      instance.unstable_handleError(error, info);
      return;
    case HostRoot:
      if (firstUncaughtError === null) {
        // If this is the host container, we treat it as a no-op error
        // boundary. We'll throw the first uncaught error once it's safe to
        // do so, at the end of the batch.
        firstUncaughtError = error;
      }
      return;
    default:
  }
}

function commitCallbacks(
  finishedWork: Fiber,
  queue: UpdateQueue,
  context: mixed,
) {
  const callbackList = queue.callbackList;
  if (callbackList === null) {
    return;
  }
  for (let i = 0; i < callbackList.length; i++) {
    const callback = callbackList[i];
    callback.call(context);
  }
}

function commitLifeCycles(current: Fiber | null, finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case ClassComponent: {
      const instance = finishedWork.stateNode;
      if (finishedWork.effectTag & Update) {
        if (current === null) {
          instance.componentDidMount();
        } else {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          instance.componentDidUpdate(prevProps, prevState);
        }
      }
      if (
        finishedWork.effectTag & Callback &&
        finishedWork.updateQueue !== null
      ) {
        commitCallbacks(finishedWork, finishedWork.updateQueue, instance);
      }
      return;
    }
    case HostRoot: {
      const updateQueue = finishedWork.updateQueue;
      if (updateQueue !== null) {
        const instance = finishedWork.child && finishedWork.child.stateNode;
        commitCallbacks(finishedWork, updateQueue, instance);
      }
      return;
    }
    case HostComponent: {
      const instance: I = finishedWork.stateNode;

      // Renderers may schedule work to be done after host components are mounted
      // (eg DOM renderer may schedule auto-focus for inputs and form controls).
      // These effects should only be committed when components are first mounted,
      // aka when there is no current/alternate.
      if (current === null && finishedWork.effectTag & Update) {
        const type = finishedWork.type;
        const props = finishedWork.memoizedProps;
        commitMount(instance, type, props, finishedWork);
      }

      return;
    }
    case HostText: {
      // We have no life-cycles associated with text.
      return;
    }
    case HostPortal: {
      // We have no life-cycles associated with portals.
      return;
    }
    default: {
    }
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

// This is a constructor of a POJO instead of a constructor function for a few
// reasons:
// 1) Nobody should add any instance methods on this. Instance methods can be
//    more difficult to predict when they get optimized and they are almost
//    never inlined properly in static compilers.
// 2) Nobody should rely on `instanceof Fiber` for type testing. We should
//    always know when it is a fiber.
// 3) We can easily go from a createFiber call to calling a constructor if that
//    is faster. The opposite is not true.
// 4) We might want to experiment with using numeric keys since they are easier
//    to optimize in a non-JIT environment.
// 5) It should be easy to port this to a C struct and keep a C implementation
//    compatible.
function createFiber(
  tag: TypeOfWork,
  key: null | string,
  internalContextTag: TypeOfInternalContext,
): Fiber {
  var fiber: Fiber = {
    // Instance

    tag: tag,

    key: key,

    type: null,

    stateNode: null,

    // Fiber

    return: null,

    child: null,
    sibling: null,
    index: 0,

    ref: null,

    pendingProps: null,
    memoizedProps: null,
    updateQueue: null,
    memoizedState: null,

    internalContextTag,

    effectTag: NoEffect,
    nextEffect: null,
    firstEffect: null,
    lastEffect: null,

    pendingWorkPriority: NoWork,
    progressedPriority: NoWork,
    progressedChild: null,
    progressedFirstDeletion: null,
    progressedLastDeletion: null,

    alternate: null,
  };
  return fiber;
}

// Clones an update queue from a source fiber onto its alternate.
function cloneUpdateQueue(
  current: Fiber,
  workInProgress: Fiber,
): UpdateQueue | null {
  const currentQueue = current.updateQueue;
  if (currentQueue === null) {
    // The source fiber does not have an update queue.
    workInProgress.updateQueue = null;
    return null;
  }
  // If the alternate already has a queue, reuse the previous object.
  const altQueue = workInProgress.updateQueue !== null
    ? workInProgress.updateQueue
    : {};
  altQueue.first = currentQueue.first;
  altQueue.last = currentQueue.last;

  // These fields are invalid by the time we clone from current. Reset them.
  altQueue.hasForceUpdate = false;
  altQueue.callbackList = null;
  altQueue.isProcessing = false;

  workInProgress.updateQueue = altQueue;

  return altQueue;
}

// This is used to create an alternate fiber to do work on.
// TODO: Rename to createWorkInProgressFiber or something like that.
function cloneFiber(
  fiber: Fiber,
  priorityLevel: PriorityLevel,
): Fiber {
  // We clone to get a work in progress. That means that this fiber is the
  // current. To make it safe to reuse that fiber later on as work in progress
  // we need to reset its work in progress flag now. We don't have an
  // opportunity to do this earlier since we don't traverse the tree when
  // the work in progress tree becomes the current tree.
  // fiber.progressedPriority = NoWork;
  // fiber.progressedChild = null;

  // We use a double buffering pooling technique because we know that we'll only
  // ever need at most two versions of a tree. We pool the "other" unused node
  // that we're free to reuse. This is lazily created to avoid allocating extra
  // objects for things that are never updated. It also allow us to reclaim the
  // extra memory if needed.
  let alt = fiber.alternate;
  if (alt !== null) {
    // If we clone, then we do so from the "current" state. The current state
    // can't have any side-effects that are still valid so we reset just to be
    // sure.
    alt.effectTag = NoEffect;
    alt.nextEffect = null;
    alt.firstEffect = null;
    alt.lastEffect = null;
  } else {
    // This should not have an alternate already
    alt = createFiber(fiber.tag, fiber.key, fiber.internalContextTag);
    alt.type = fiber.type;

    alt.progressedChild = fiber.progressedChild;
    alt.progressedPriority = fiber.progressedPriority;

    alt.alternate = fiber;
    fiber.alternate = alt;
  }

  alt.stateNode = fiber.stateNode;
  alt.child = fiber.child;
  alt.sibling = fiber.sibling; // This should always be overridden. TODO: null
  alt.index = fiber.index; // This should always be overridden.
  alt.ref = fiber.ref;
  // pendingProps is here for symmetry but is unnecessary in practice for now.
  // TODO: Pass in the new pendingProps as an argument maybe?
  alt.pendingProps = fiber.pendingProps;
  cloneUpdateQueue(fiber, alt);
  alt.pendingWorkPriority = priorityLevel;

  alt.memoizedProps = fiber.memoizedProps;
  alt.memoizedState = fiber.memoizedState;

  if (__DEV__) {
    alt._debugID = fiber._debugID;
    alt._debugSource = fiber._debugSource;
    alt._debugOwner = fiber._debugOwner;
  }

  return alt;
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
  // If we caught any errors during this commit, schedule their boundaries
  // to update.
  if (commitPhaseBoundaries) {
    commitPhaseBoundaries.forEach(scheduleErrorRecovery);
    commitPhaseBoundaries = null;
  }

  priorityContext = previousPriorityContext;
}

function hasCapturedError(fiber: Fiber): boolean {
  // TODO: capturedErrors should store the boundary instance, to avoid needing
  // to check the alternate.
  return (
    capturedErrors !== null &&
    (capturedErrors.has(fiber) ||
      (fiber.alternate !== null && capturedErrors.has(fiber.alternate)))
  );
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

function performFailedUnitOfWork(workInProgress: Fiber): Fiber | null {
  // The current, flushed, state of this fiber is the alternate.
  // Ideally nothing should rely on this, but relying on it here
  // means that we don't need an additional field on the work in
  // progress.
  const current = workInProgress.alternate;

  // See if beginning this work spawns more work.
  let next = beginFailedWork(current, workInProgress, nextPriorityLevel);

  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    next = completeUnitOfWork(workInProgress);
  }

  currentOwner = null;
  return next;
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

function push<T>(
  cursor: StackCursor<T>,
  value: T,
  fiber: Fiber,
): void {
  index++;

  valueStack[index] = cursor.current;
  cursor.current = value;
}

function pushContextProvider(workInProgress: Fiber): boolean {
  if (!isContextProvider(workInProgress)) {
    return false;
  }

  const instance = workInProgress.stateNode;
  // We push the context as early as possible to ensure stack integrity.
  // If the instance does not exist yet, we will push null at first,
  // and replace it on the stack later when invalidating the context.
  const memoizedMergedChildContext =
    (instance && instance.__reactInternalMemoizedMergedChildContext) ||
    emptyObject;

  // Remember the parent context so we can merge with it later.
  previousContext = contextStackCursor.current;
  push(contextStackCursor, memoizedMergedChildContext, workInProgress);
  push(didPerformWorkStackCursor, false, workInProgress);

  return true;
}

function pushHostContainer(fiber: Fiber, nextRootInstance: C) {
  // Push current root instance onto the stack;
  // This allows us to reset root when portals are popped.
  push(rootInstanceStackCursor, nextRootInstance, fiber);

  const nextRootContext = getRootHostContext(nextRootInstance);

  // Track the context and the Fiber that provided it.
  // This enables us to pop only Fibers that provide unique contexts.
  push(contextFiberStackCursor, fiber, fiber);
  push(contextStackCursor, nextRootContext, fiber);
}

function bailoutOnLowPriority(current, workInProgress) {
  // TODO: Handle HostComponent tags here as well and call pushHostContext()?
  // See PR 8590 discussion for context
  switch (workInProgress.tag) {
    case ClassComponent:
      pushContextProvider(workInProgress);
      break;
    case HostPortal:
      pushHostContainer(
        workInProgress,
        workInProgress.stateNode.containerInfo,
      );
      break;
  }
  // TODO: What if this is currently in progress?
  // How can that happen? How is this not being cloned?
  return null;
}

function clearDeletions(workInProgress) {
  workInProgress.progressedFirstDeletion = workInProgress.progressedLastDeletion = null;
}

function transferDeletions(workInProgress) {
  // Any deletions get added first into the effect list.
  workInProgress.firstEffect = workInProgress.progressedFirstDeletion;
  workInProgress.lastEffect = workInProgress.progressedLastDeletion;
}

function reconcileChildrenAtPriority(
  current,
  workInProgress,
  nextChildren,
  priorityLevel,
) {
  // At this point any memoization is no longer valid since we'll have changed
  // the children.
  workInProgress.memoizedProps = null;
  if (current === null) {
    // If this is a fresh new component that hasn't been rendered yet, we
    // won't update its child set by applying minimal side-effects. Instead,
    // we will add them all to the child before it gets rendered. That means
    // we can optimize this reconciliation pass by not tracking side-effects.
    workInProgress.child = mountChildFibersInPlace(
      workInProgress,
      workInProgress.child,
      nextChildren,
      priorityLevel,
    );
  } else if (current.child === workInProgress.child) {
    // If the current child is the same as the work in progress, it means that
    // we haven't yet started any work on these children. Therefore, we use
    // the clone algorithm to create a copy of all the current children.

    // If we had any progressed work already, that is invalid at this point so
    // let's throw it out.
    clearDeletions(workInProgress);

    workInProgress.child = reconcileChildFibers(
      workInProgress,
      workInProgress.child,
      nextChildren,
      priorityLevel,
    );

    transferDeletions(workInProgress);
  } else {
    // If, on the other hand, it is already using a clone, that means we've
    // already begun some work on this tree and we can continue where we left
    // off by reconciling against the existing children.
    workInProgress.child = reconcileChildFibersInPlace(
      workInProgress,
      workInProgress.child,
      nextChildren,
      priorityLevel,
    );

    transferDeletions(workInProgress);
  }
  markChildAsProgressed(current, workInProgress, priorityLevel);
}

function reconcileChildren(current, workInProgress, nextChildren) {
  const priorityLevel = workInProgress.pendingWorkPriority;
  reconcileChildrenAtPriority(
    current,
    workInProgress,
    nextChildren,
    priorityLevel,
  );
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

function memoizeProps(workInProgress: Fiber, nextProps: any) {
  workInProgress.memoizedProps = nextProps;
  // Reset the pending props
  workInProgress.pendingProps = null;
}

function memoizeState(workInProgress: Fiber, nextState: any) {
  workInProgress.memoizedState = nextState;
  // Don't reset the updateQueue, in case there are pending updates. Resetting
  // is handled by beginUpdateQueue.
}

function cacheContext(
  workInProgress: Fiber,
  unmaskedContext: Object,
  maskedContext: Object,
) {
  const instance = workInProgress.stateNode;
  instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
  instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
}

function getUnmaskedContext(workInProgress: Fiber): Object {
  const hasOwnContext = isContextProvider(workInProgress);
  if (hasOwnContext) {
    // If the fiber is a context provider itself, when we read its context
    // we have already pushed its own child context on the stack. A context
    // provider should not "see" its own child context. Therefore we read the
    // previous (parent) context instead for a context provider.
    return previousContext;
  }
  return contextStackCursor.current;
}

 function getMaskedContext(
  workInProgress: Fiber,
  unmaskedContext: Object,
) {
  const type = workInProgress.type;
  const contextTypes = type.contextTypes;
  if (!contextTypes) {
    return emptyObject;
  }

  // Avoid recreating masked context unless unmasked context has changed.
  // Failing to do this will result in unnecessary calls to componentWillReceiveProps.
  // This may trigger infinite loops if componentWillReceiveProps calls setState.
  const instance = workInProgress.stateNode;
  if (
    instance &&
    instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext
  ) {
    return instance.__reactInternalMemoizedMaskedChildContext;
  }

  const context = {};
  for (let key in contextTypes) {
    context[key] = unmaskedContext[key];
  }
  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // Context is created before the class component is instantiated so check for instance.
  if (instance) {
    cacheContext(workInProgress, unmaskedContext, context);
  }

  return context;
}

function callComponentWillMount(workInProgress, instance) {
  const oldState = instance.state;
  instance.componentWillMount();

  if (oldState !== instance.state) {
    updater.enqueueReplaceState(instance, instance.state, null);
  }
}

function getStateFromUpdate(update, instance, prevState, props) {
  const partialState = update.partialState;
  if (typeof partialState === 'function') {
    const updateFn = partialState;
    return updateFn.call(instance, prevState, props);
  } else {
    return partialState;
  }
}

function beginUpdateQueue(
  workInProgress: Fiber,
  queue: UpdateQueue,
  instance: any,
  prevState: any,
  props: any,
  priorityLevel: PriorityLevel,
): any {
  queue.hasForceUpdate = false;

  // Applies updates with matching priority to the previous state to create
  // a new state object.
  let state = prevState;
  let dontMutatePrevState = true;
  let callbackList = queue.callbackList;
  let update = queue.first;
  while (
    update !== null &&
    comparePriority(update.priorityLevel, priorityLevel) <= 0
  ) {
    // Remove each update from the queue right before it is processed. That way
    // if setState is called from inside an updater function, the new update
    // will be inserted in the correct position.
    queue.first = update.next;
    if (queue.first === null) {
      queue.last = null;
    }

    let partialState;
    if (update.isReplace) {
      state = getStateFromUpdate(update, instance, state, props);
      dontMutatePrevState = true;
    } else {
      partialState = getStateFromUpdate(update, instance, state, props);
      if (partialState) {
        if (dontMutatePrevState) {
          state = Object.assign({}, state, partialState);
        } else {
          state = Object.assign(state, partialState);
        }
        dontMutatePrevState = false;
      }
    }
    if (update.isForced) {
      queue.hasForceUpdate = true;
    }
    // Second condition ignores top-level unmount callbacks if they are not the
    // last update in the queue, since a subsequent update will cause a remount.
    if (
      update.callback !== null &&
      !(update.isTopLevelUnmount && update.next !== null)
    ) {
      callbackList = callbackList || [];
      callbackList.push(update.callback);
      workInProgress.effectTag |= Callback;
    }
    update = update.next;
  }

  queue.callbackList = callbackList;

  if (queue.first === null && callbackList === null && !queue.hasForceUpdate) {
    // The queue is empty and there are no callbacks. We can reset it.
    workInProgress.updateQueue = null;
  }
  return state;
}

// Invokes the mount life-cycles on a previously never rendered instance.
function mountClassInstance(
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
): void {
  const instance = workInProgress.stateNode;
  const state = instance.state || null;

  let props = workInProgress.pendingProps;

  const unmaskedContext = getUnmaskedContext(workInProgress);

  instance.props = props;
  instance.state = state;
  instance.refs = emptyObject;
  instance.context = getMaskedContext(workInProgress, unmaskedContext);

  if (
    enableAsyncSubtreeAPI &&
    workInProgress.type != null &&
    workInProgress.type.unstable_asyncUpdates === true
  ) {
    workInProgress.internalContextTag |= AsyncUpdates;
  }

  if (typeof instance.componentWillMount === 'function') {
    callComponentWillMount(workInProgress, instance);
    // If we had additional state updates during this life-cycle, let's
    // process them now.
    const updateQueue = workInProgress.updateQueue;
    if (updateQueue !== null) {
      instance.state = beginUpdateQueue(
        workInProgress,
        updateQueue,
        instance,
        state,
        props,
        priorityLevel,
      );
    }
  }
  if (typeof instance.componentDidMount === 'function') {
    workInProgress.effectTag |= Update;
  }
}

function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = updater;
  workInProgress.stateNode = instance;
  // The instance needs access to the fiber so that it can schedule updates
  ReactInstanceMap.set(instance, workInProgress);
}

function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber,
): void {
  if (!workInProgress.child) {
    return;
  }
  if (current !== null && workInProgress.child === current.child) {
    // We use workInProgress.child since that lets Flow know that it can't be
    // null since we validated that already. However, as the line above suggests
    // they're actually the same thing.
    let currentChild = workInProgress.child;
    // TODO: This used to reset the pending priority. Not sure if that is needed.
    // workInProgress.pendingWorkPriority = current.pendingWorkPriority;
    // TODO: The below priority used to be set to NoWork which would've
    // dropped work. This is currently unobservable but will become
    // observable when the first sibling has lower priority work remaining
    // than the next sibling. At that point we should add tests that catches
    // this.
    let newChild = cloneFiber(currentChild, currentChild.pendingWorkPriority);
    workInProgress.child = newChild;

    newChild.return = workInProgress;
    while (currentChild.sibling !== null) {
      currentChild = currentChild.sibling;
      newChild = newChild.sibling = cloneFiber(
        currentChild,
        currentChild.pendingWorkPriority,
      );
      newChild.return = workInProgress;
    }
    newChild.sibling = null;
  } else {
    // If there is no alternate, then we don't need to clone the children.
    // If the children of the alternate fiber is a different set, then we don't
    // need to clone. We need to reset the return fiber though since we'll
    // traverse down into them.
    let child = workInProgress.child;
    while (child !== null) {
      child.return = workInProgress;
      child = child.sibling;
    }
  }
};

function bailoutOnAlreadyFinishedWork(
  current,
  workInProgress: Fiber,
): Fiber | null {
  const priorityLevel = workInProgress.pendingWorkPriority;
  // TODO: We should ideally be able to bail out early if the children have no
  // more work to do. However, since we don't have a separation of this
  // Fiber's priority and its children yet - we don't know without doing lots
  // of the same work we do anyway. Once we have that separation we can just
  // bail out here if the children has no more work at this priority level.
  // if (workInProgress.priorityOfChildren <= priorityLevel) {
  //   // If there are side-effects in these children that have not yet been
  //   // committed we need to ensure that they get properly transferred up.
  //   if (current && current.child !== workInProgress.child) {
  //     reuseChildrenEffects(workInProgress, child);
  //   }
  //   return null;
  // }

  if (current && workInProgress.child === current.child) {
    // If we had any progressed work already, that is invalid at this point so
    // let's throw it out.
    clearDeletions(workInProgress);
  }

  cloneChildFibers(current, workInProgress);
  markChildAsProgressed(current, workInProgress, priorityLevel);
  return workInProgress.child;
}

function invalidateContextProvider(workInProgress: Fiber): void {
  const instance = workInProgress.stateNode;

  // Merge parent and own context.
  const mergedContext = processChildContext(
    workInProgress,
    previousContext,
    true,
  );
  instance.__reactInternalMemoizedMergedChildContext = mergedContext;

  // Replace the old (or empty) context with the new one.
  // It is important to unwind the context in the reverse order.
  pop(didPerformWorkStackCursor, workInProgress);
  pop(contextStackCursor, workInProgress);
  // Now push the new context and mark that it has changed.
  push(contextStackCursor, mergedContext, workInProgress);
  push(didPerformWorkStackCursor, true, workInProgress);
};

function finishClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  shouldUpdate: boolean,
  hasContext: boolean,
) {
  // Refs should update even if shouldComponentUpdate returns false
  finishMarkRef(current, workInProgress);

  if (!shouldUpdate) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }

  const instance = workInProgress.stateNode;

  // Rerender
  currentOwner = workInProgress;
  let nextChildren;
  nextChildren = instance.render();
  reconcileChildren(current, workInProgress, nextChildren);
  // Memoize props and state using the values we just used to render.
  // TODO: Restructure so we never read values from the instance.
  memoizeState(workInProgress, instance.state);
  memoizeProps(workInProgress, instance.props);

  // The context might have changed so we need to recalculate it.
  if (hasContext) {
    invalidateContextProvider(workInProgress);
  }
  return workInProgress.child;
}

function mountIndeterminateComponent(current, workInProgress, priorityLevel) {
  var fn = workInProgress.type;
  var props = workInProgress.pendingProps;
  var unmaskedContext = getUnmaskedContext(workInProgress);
  var context = getMaskedContext(workInProgress, unmaskedContext);

  const value = fn(props, context);

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.render === 'function'
  ) {
    // Proceed under the assumption that this is a class instance
    workInProgress.tag = ClassComponent;

    // Push context providers early to prevent context stack mismatches.
    // During mounting we don't know the child context yet as the instance doesn't exist.
    // We will invalidate the child context in finishClassComponent() right after rendering.
    const hasContext = pushContextProvider(workInProgress);
    adoptClassInstance(workInProgress, value);
    mountClassInstance(workInProgress, priorityLevel);
    return finishClassComponent(current, workInProgress, true, hasContext);
  } else {
    // Proceed under the assumption that this is a functional component
    workInProgress.tag = FunctionalComponent;
    reconcileChildren(current, workInProgress, value);
    memoizeProps(workInProgress, props);
    return workInProgress.child;
  }
}

function hasContextChanged(): boolean {
  return didPerformWorkStackCursor.current;
}

function updateFunctionalComponent(current, workInProgress) {
  var fn = workInProgress.type;
  var nextProps = workInProgress.pendingProps;

  const memoizedProps = workInProgress.memoizedProps;
  if (hasContextChanged()) {
    // Normally we can bail out on props equality but if context has changed
    // we don't do the bailout and we have to reuse existing props instead.
    if (nextProps === null) {
      nextProps = memoizedProps;
    }
  } else {
    if (nextProps === null || memoizedProps === nextProps) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
    // TODO: Disable this before release, since it is not part of the public API
    // I use this for testing to compare the relative overhead of classes.
    if (
      typeof fn.shouldComponentUpdate === 'function' &&
      !fn.shouldComponentUpdate(memoizedProps, nextProps)
    ) {
      // Memoize props even if shouldComponentUpdate returns false
      memoizeProps(workInProgress, nextProps);
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
  }

  var unmaskedContext = getUnmaskedContext(workInProgress);
  var context = getMaskedContext(workInProgress, unmaskedContext);

  var nextChildren;

  nextChildren = fn(nextProps, context);
  reconcileChildren(current, workInProgress, nextChildren);
  memoizeProps(workInProgress, nextProps);
  return workInProgress.child;
}

function isContextConsumer(fiber: Fiber): boolean {
  return fiber.tag === ClassComponent && fiber.type.contextTypes != null;
}

function constructClassInstance(workInProgress: Fiber, props: any): any {
  const ctor = workInProgress.type;
  const unmaskedContext = getUnmaskedContext(workInProgress);
  const needsContext = isContextConsumer(workInProgress);
  const context = needsContext
    ? getMaskedContext(workInProgress, unmaskedContext)
    : emptyObject;
  const instance = new ctor(props, context);
  adoptClassInstance(workInProgress, instance);

  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (needsContext) {
    cacheContext(workInProgress, unmaskedContext, context);
  }

  return instance;
}

function resetInputPointers(workInProgress: Fiber, instance: any) {
  instance.props = workInProgress.memoizedProps;
  instance.state = workInProgress.memoizedState;
}

function callComponentWillReceiveProps(
  workInProgress,
  instance,
  newProps,
  newContext,
) {
  const oldState = instance.state;
  instance.componentWillReceiveProps(newProps, newContext);

  if (instance.state !== oldState) {
    updater.enqueueReplaceState(instance, instance.state, null);
  }
}

function checkShouldComponentUpdate(
  workInProgress,
  oldProps,
  newProps,
  oldState,
  newState,
  newContext,
) {
  if (
    oldProps === null ||
    (workInProgress.updateQueue !== null &&
      workInProgress.updateQueue.hasForceUpdate)
  ) {
    // If the workInProgress already has an Update effect, return true
    return true;
  }

  const instance = workInProgress.stateNode;
  const type = workInProgress.type;
  if (typeof instance.shouldComponentUpdate === 'function') {
    const shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      newContext,
    );
    return shouldUpdate;
  }

  if (type.prototype && type.prototype.isPureReactComponent) {
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    );
  }

  return true;
}

// Called on a preexisting class instance. Returns false if a resumed render
// could be reused.
function resumeMountClassInstance(
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
): boolean {
  const instance = workInProgress.stateNode;
  resetInputPointers(workInProgress, instance);

  let newState = workInProgress.memoizedState;
  let newProps = workInProgress.pendingProps;
  if (!newProps) {
    // If there isn't any new props, then we'll reuse the memoized props.
    // This could be from already completed work.
    newProps = workInProgress.memoizedProps;
  }
  const newUnmaskedContext = getUnmaskedContext(workInProgress);
  const newContext = getMaskedContext(workInProgress, newUnmaskedContext);

  const oldContext = instance.context;
  const oldProps = workInProgress.memoizedProps;

  if (
    typeof instance.componentWillReceiveProps === 'function' &&
    (oldProps !== newProps || oldContext !== newContext)
  ) {
    callComponentWillReceiveProps(
      workInProgress,
      instance,
      newProps,
      newContext,
    );
  }

  // Process the update queue before calling shouldComponentUpdate
  const updateQueue = workInProgress.updateQueue;
  if (updateQueue !== null) {
    newState = beginUpdateQueue(
      workInProgress,
      updateQueue,
      instance,
      newState,
      newProps,
      priorityLevel,
    );
  }

  // TODO: Should we deal with a setState that happened after the last
  // componentWillMount and before this componentWillMount? Probably
  // unsupported anyway.

  if (
    !checkShouldComponentUpdate(
      workInProgress,
      workInProgress.memoizedProps,
      newProps,
      workInProgress.memoizedState,
      newState,
      newContext,
    )
  ) {
    // Update the existing instance's state, props, and context pointers even
    // though we're bailing out.
    instance.props = newProps;
    instance.state = newState;
    instance.context = newContext;
    return false;
  }

  // Update the input pointers now so that they are correct when we call
  // componentWillMount
  instance.props = newProps;
  instance.state = newState;
  instance.context = newContext;

  if (typeof instance.componentWillMount === 'function') {
    callComponentWillMount(workInProgress, instance);
    // componentWillMount may have called setState. Process the update queue.
    const newUpdateQueue = workInProgress.updateQueue;
    if (newUpdateQueue !== null) {
      newState = beginUpdateQueue(
        workInProgress,
        newUpdateQueue,
        instance,
        newState,
        newProps,
        priorityLevel,
      );
    }
  }

  if (typeof instance.componentDidMount === 'function') {
    workInProgress.effectTag |= Update;
  }

  instance.state = newState;

  return true;
}

// Invokes the update life-cycles and returns false if it shouldn't rerender.
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
): boolean {
  const instance = workInProgress.stateNode;
  resetInputPointers(workInProgress, instance);

  const oldProps = workInProgress.memoizedProps;
  let newProps = workInProgress.pendingProps;
  if (!newProps) {
    // If there aren't any new props, then we'll reuse the memoized props.
    // This could be from already completed work.
    newProps = oldProps;
  }
  const oldContext = instance.context;
  const newUnmaskedContext = getUnmaskedContext(workInProgress);
  const newContext = getMaskedContext(workInProgress, newUnmaskedContext);

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  if (
    typeof instance.componentWillReceiveProps === 'function' &&
    (oldProps !== newProps || oldContext !== newContext)
  ) {
    callComponentWillReceiveProps(
      workInProgress,
      instance,
      newProps,
      newContext,
    );
  }

  // Compute the next state using the memoized state and the update queue.
  const updateQueue = workInProgress.updateQueue;
  const oldState = workInProgress.memoizedState;
  // TODO: Previous state can be null.
  let newState;
  if (updateQueue !== null) {
    newState = beginUpdateQueue(
      workInProgress,
      updateQueue,
      instance,
      oldState,
      newProps,
      priorityLevel,
    );
  } else {
    newState = oldState;
  }

  if (
    oldProps === newProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !(updateQueue !== null && updateQueue.hasForceUpdate)
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

  const shouldUpdate = checkShouldComponentUpdate(
    workInProgress,
    oldProps,
    newProps,
    oldState,
    newState,
    newContext,
  );

  if (shouldUpdate) {
    if (typeof instance.componentWillUpdate === 'function') {
      instance.componentWillUpdate(newProps, newState, newContext);
    }
    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.effectTag |= Update;
    }
  } else {
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

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    memoizeProps(workInProgress, newProps);
    memoizeState(workInProgress, newState);
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = newContext;

  return shouldUpdate;
}

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  priorityLevel: PriorityLevel,
) {
  // Push context providers early to prevent context stack mismatches.
  // During mounting we don't know the child context yet as the instance doesn't exist.
  // We will invalidate the child context in finishClassComponent() right after rendering.
  const hasContext = pushContextProvider(workInProgress);

  let shouldUpdate;
  if (current === null) {
    if (!workInProgress.stateNode) {
      // In the initial pass we might need to construct the instance.
      constructClassInstance(workInProgress, workInProgress.pendingProps);
      mountClassInstance(workInProgress, priorityLevel);
      shouldUpdate = true;
    } else {
      // In a resume, we'll already have an instance we can reuse.
      shouldUpdate = resumeMountClassInstance(workInProgress, priorityLevel);
    }
  } else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      priorityLevel,
    );
  }
  return finishClassComponent(
    current,
    workInProgress,
    shouldUpdate,
    hasContext,
  );
}

function pushTopLevelContextObject(
  fiber: Fiber,
  context: Object,
  didChange: boolean,
): void {
  push(contextStackCursor, context, fiber);
  push(didPerformWorkStackCursor, didChange, fiber);
}

function updateHostRoot(current, workInProgress, priorityLevel) {
  const root = (workInProgress.stateNode: FiberRoot);
  if (root.pendingContext) {
    pushTopLevelContextObject(
      workInProgress,
      root.pendingContext,
      root.pendingContext !== root.context,
    );
  } else if (root.context) {
    // Should always be set
    pushTopLevelContextObject(workInProgress, root.context, false);
  }

  pushHostContainer(workInProgress, root.containerInfo);

  const updateQueue = workInProgress.updateQueue;
  if (updateQueue !== null) {
    const prevState = workInProgress.memoizedState;
    const state = beginUpdateQueue(
      workInProgress,
      updateQueue,
      null,
      prevState,
      null,
      priorityLevel,
    );
    if (prevState === state) {
      // If the state is the same as before, that's a bailout because we had
      // no work matching this priority.
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
    const element = state.element;
    reconcileChildren(current, workInProgress, element);
    memoizeState(workInProgress, state);
    return workInProgress.child;
  }
  // If there is no update queue, that's a bailout because the root has no props.
  return bailoutOnAlreadyFinishedWork(current, workInProgress);
}

function pushHostContext(fiber: Fiber): void {
  const rootInstance = requiredContext(rootInstanceStackCursor.current);
  const context = requiredContext(contextStackCursor.current);
  const nextContext = getChildHostContext(context, fiber.type, rootInstance);

  // Don't push this Fiber's context unless it's unique.
  if (context === nextContext) {
    return;
  }

  // Track the context and the Fiber that provided it.
  // This enables us to pop only Fibers that provide unique contexts.
  push(contextFiberStackCursor, fiber, fiber);
  push(contextStackCursor, nextContext, fiber);
}

function updateHostComponent(current, workInProgress) {
  pushHostContext(workInProgress);

  let nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;
  const memoizedProps = workInProgress.memoizedProps;
  if (hasContextChanged()) {
    // Normally we can bail out on props equality but if context has changed
    // we don't do the bailout and we have to reuse existing props instead.
    if (nextProps === null) {
      nextProps = memoizedProps;
    }
  } else if (nextProps === null || memoizedProps === nextProps) {
    if (
      !useSyncScheduling &&
      shouldDeprioritizeSubtree(workInProgress.type, memoizedProps) &&
      workInProgress.pendingWorkPriority !== OffscreenPriority
    ) {
      // This subtree still has work, but it should be deprioritized so we need
      // to bail out and not do any work yet.
      // TODO: It would be better if this tree got its correct priority set
      // during scheduleUpdate instead because otherwise we'll start a higher
      // priority reconciliation first before we can get down here. However,
      // that is a bit tricky since workInProgress and current can have
      // different "hidden" settings.
      let child = workInProgress.progressedChild;
      while (child !== null) {
        // To ensure that this subtree gets its priority reset, the children
        // need to be reset.
        child.pendingWorkPriority = OffscreenPriority;
        child = child.sibling;
      }
      return null;
    }
    return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }

  let nextChildren = nextProps.children;
  const isDirectTextChild = shouldSetTextContent(nextProps);

  if (isDirectTextChild) {
    // We special case a direct text child of a host node. This is a common
    // case. We won't handle it as a reified child. We will instead handle
    // this in the host environment that also have access to this prop. That
    // avoids allocating another HostText fiber and traversing it.
    nextChildren = null;
  } else if (prevProps && shouldSetTextContent(prevProps)) {
    // If we're switching from a direct text child to a normal child, or to
    // empty, we need to schedule the text content to be reset.
    workInProgress.effectTag |= ContentReset;
  }

  beginMarkRef(current, workInProgress);

  if (
    !useSyncScheduling &&
    shouldDeprioritizeSubtree(workInProgress.type, nextProps) &&
    workInProgress.pendingWorkPriority !== OffscreenPriority
  ) {
    // If this host component is hidden, we can bail out on the children.
    // We'll rerender the children later at the lower priority.

    // It is unfortunate that we have to do the reconciliation of these
    // children already since that will add them to the tree even though
    // they are not actually done yet. If this is a large set it is also
    // confusing that this takes time to do right now instead of later.

    if (workInProgress.progressedPriority === OffscreenPriority) {
      // If we already made some progress on the offscreen priority before,
      // then we should continue from where we left off.
      workInProgress.child = workInProgress.progressedChild;
    }

    // Reconcile the children and stash them for later work.
    reconcileChildrenAtPriority(
      current,
      workInProgress,
      nextChildren,
      OffscreenPriority,
    );
    memoizeProps(workInProgress, nextProps);
    workInProgress.child = current !== null ? current.child : null;

    if (current === null) {
      // If this doesn't have a current we won't track it for placement
      // effects. However, when we come back around to this we have already
      // inserted the parent which means that we'll infact need to make this a
      // placement.
      // TODO: There has to be a better solution to this problem.
      let child = workInProgress.progressedChild;
      while (child !== null) {
        child.effectTag = Placement;
        child = child.sibling;
      }
    }

    // Abort and don't process children yet.
    return null;
  } else {
    reconcileChildren(current, workInProgress, nextChildren);
    memoizeProps(workInProgress, nextProps);
    return workInProgress.child;
  }
}

function updateHostText(current, workInProgress) {
  let nextProps = workInProgress.pendingProps;
  if (nextProps === null) {
    nextProps = workInProgress.memoizedProps;
  }
  memoizeProps(workInProgress, nextProps);
  // Nothing to do here. This is terminal. We'll do the completion step
  // immediately after.
  return null;
}

function updateCoroutineComponent(current, workInProgress) {
  var nextCoroutine = (workInProgress.pendingProps: null | ReactCoroutine);
  if (hasContextChanged()) {
    // Normally we can bail out on props equality but if context has changed
    // we don't do the bailout and we have to reuse existing props instead.
    if (nextCoroutine === null) {
      nextCoroutine = current && current.memoizedProps;
    }
  } else if (
    nextCoroutine === null ||
    workInProgress.memoizedProps === nextCoroutine
  ) {
    nextCoroutine = workInProgress.memoizedProps;
    // TODO: When bailing out, we might need to return the stateNode instead
    // of the child. To check it for work.
    // return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }

  const nextChildren = nextCoroutine.children;
  const priorityLevel = workInProgress.pendingWorkPriority;

  // The following is a fork of reconcileChildrenAtPriority but using
  // stateNode to store the child.

  // At this point any memoization is no longer valid since we'll have changed
  // the children.
  workInProgress.memoizedProps = null;
  if (current === null) {
    workInProgress.stateNode = mountChildFibersInPlace(
      workInProgress,
      workInProgress.stateNode,
      nextChildren,
      priorityLevel,
    );
  } else if (current.child === workInProgress.child) {
    clearDeletions(workInProgress);

    workInProgress.stateNode = reconcileChildFibers(
      workInProgress,
      workInProgress.stateNode,
      nextChildren,
      priorityLevel,
    );

    transferDeletions(workInProgress);
  } else {
    workInProgress.stateNode = reconcileChildFibersInPlace(
      workInProgress,
      workInProgress.stateNode,
      nextChildren,
      priorityLevel,
    );

    transferDeletions(workInProgress);
  }

  memoizeProps(workInProgress, nextCoroutine);
  // This doesn't take arbitrary time so we could synchronously just begin
  // eagerly do the work of workInProgress.child as an optimization.
  return workInProgress.stateNode;
}

function updatePortalComponent(current, workInProgress) {
  pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
  const priorityLevel = workInProgress.pendingWorkPriority;
  let nextChildren = workInProgress.pendingProps;
  if (hasContextChanged()) {
    // Normally we can bail out on props equality but if context has changed
    // we don't do the bailout and we have to reuse existing props instead.
    if (nextChildren === null) {
      nextChildren = current && current.memoizedProps;
    }
  } else if (
    nextChildren === null ||
    workInProgress.memoizedProps === nextChildren
  ) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }

  if (current === null) {
    // Portals are special because we don't append the children during mount
    // but at commit. Therefore we need to track insertions which the normal
    // flow doesn't do during mount. This doesn't happen at the root because
    // the root always starts with a "current" with a null child.
    // TODO: Consider unifying this with how the root works.
    workInProgress.child = reconcileChildFibersInPlace(
      workInProgress,
      workInProgress.child,
      nextChildren,
      priorityLevel,
    );
    memoizeProps(workInProgress, nextChildren);
    markChildAsProgressed(current, workInProgress, priorityLevel);
  } else {
    reconcileChildren(current, workInProgress, nextChildren);
    memoizeProps(workInProgress, nextChildren);
  }
  return workInProgress.child;
}

function updateFragmentWithWorkInProgress(current, workInProgress) {
  var nextChildren = workInProgress.pendingProps;
  if (hasContextChanged()) {
    // Normally we can bail out on props equality but if context has changed
    // we don't do the bailout and we have to reuse existing props instead.
    if (nextChildren === null) {
      nextChildren = workInProgress.memoizedProps;
    }
  } else if (
    nextChildren === null ||
    workInProgress.memoizedProps === nextChildren
  ) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }
  reconcileChildren(current, workInProgress, nextChildren);
  memoizeProps(workInProgress, nextChildren);
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
      return updateFragmentWithWorkInProgress(current, workInProgress);
  }
}

function markUpdate(workInProgress: Fiber) {
  // Tag the fiber with an update effect. This turns a Placement into
  // an UpdateAndPlacement.
  workInProgress.effectTag |= Update;
}

function beginMarkRef(current: Fiber | null, workInProgress: Fiber) {
  const ref = workInProgress.ref;
  if (ref !== null && (!current || current.ref !== ref)) {
    // Schedule a Ref effect
    workInProgress.effectTag |= Ref;
  }
}

function finishMarkRef(workInProgress: Fiber) {
  workInProgress.effectTag |= Ref;
}

function getHostContext(): CX {
  const context = requiredContext(contextStackCursor.current);
  return context;
}

function markChildAsProgressed(current, workInProgress, priorityLevel) {
  // We now have clones. Let's store them as the currently progressed work.
  workInProgress.progressedChild = workInProgress.child;
  workInProgress.progressedPriority = priorityLevel;
  if (current !== null) {
    // We also store it on the current. When the alternate swaps in we can
    // continue from this point.
    current.progressedChild = workInProgress.progressedChild;
    current.progressedPriority = workInProgress.progressedPriority;
  }
}

function appendAllYields(yields: Array<mixed>, workInProgress: Fiber) {
  let node = workInProgress.stateNode;
  if (node) {
    node.return = workInProgress;
  }
  while (node !== null) {
    if (
      node.tag === HostComponent ||
      node.tag === HostText ||
      node.tag === HostPortal
    ) {
      
    } else if (node.tag === YieldComponent) {
      yields.push(node.type);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function moveCoroutineToHandlerPhase(
  current: Fiber | null,
  workInProgress: Fiber,
) {
  var coroutine = (workInProgress.memoizedProps: ?ReactCoroutine);

  // First step of the coroutine has completed. Now we need to do the second.
  // TODO: It would be nice to have a multi stage coroutine represented by a
  // single component, or at least tail call optimize nested ones. Currently
  // that requires additional fields that we don't want to add to the fiber.
  // So this requires nested handlers.
  // Note: This doesn't mutate the alternate node. I don't think it needs to
  // since this stage is reset for every pass.
  workInProgress.tag = CoroutineHandlerPhase;

  // Build up the yields.
  // TODO: Compare this to a generator or opaque helpers like Children.
  var yields = [];
  appendAllYields(yields, workInProgress);
  var fn = coroutine.handler;
  var props = coroutine.props;
  var nextChildren = fn(props, yields);

  var currentFirstChild = current !== null ? current.child : null;
  // Inherit the priority of the returnFiber.
  const priority = workInProgress.pendingWorkPriority;
  workInProgress.child = reconcileChildFibers(
    workInProgress,
    currentFirstChild,
    nextChildren,
    priority,
  );
  markChildAsProgressed(current, workInProgress, priority);
  return workInProgress.child;
}

function appendAllChildren(parent: I, workInProgress: Fiber) {
  // We only have the top Fiber that was created but we need recurse down its
  // children to find all the terminal nodes.
  let node = workInProgress.child;
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.tag === HostPortal) {
      // If we have a portal child, then we don't want to traverse
      // down its children. Instead, we'll get insertions from each child in
      // the portal directly.
    } else if (node.child !== null) {
      node = node.child;
      continue;
    }
    if (node === workInProgress) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node = node.sibling;
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
          finishMarkRef(workInProgress);
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
          finishMarkRef(workInProgress);
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

function getPendingPriority(queue: UpdateQueue): PriorityLevel {
  return queue.first !== null ? queue.first.priorityLevel : NoWork;
}

function resetWorkPriority(workInProgress: Fiber) {
  let newPriority = NoWork;

  // Check for pending update priority. This is usually null so it shouldn't
  // be a perf issue.
  const queue = workInProgress.updateQueue;
  const tag = workInProgress.tag;
  if (
    queue !== null &&
    // TODO: Revisit once updateQueue is typed properly to distinguish between
    // update payloads for host components and update queues for composites
    (tag === ClassComponent || tag === HostRoot)
  ) {
    newPriority = getPendingPriority(queue);
  }

  // TODO: Coroutines need to visit stateNode

  // progressedChild is going to be the child set with the highest priority.
  // Either it is the same as child, or it just bailed out because it choose
  // not to do the work.
  let child = workInProgress.progressedChild;
  while (child !== null) {
    // Ensure that remaining work priority bubbles up.
    if (
      child.pendingWorkPriority !== NoWork &&
      (newPriority === NoWork || newPriority > child.pendingWorkPriority)
    ) {
      newPriority = child.pendingWorkPriority;
    }
    child = child.sibling;
  }
  workInProgress.pendingWorkPriority = newPriority;
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

function createFiberFromYield(
  yieldNode: ReactYield,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  const fiber = createFiber(YieldComponent, null, internalContextTag);
  return fiber;
}

function createFiberFromPortal(
  portal: ReactPortal,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  const fiber = createFiber(HostPortal, portal.key, internalContextTag);
  fiber.pendingProps = portal.children || [];
  fiber.pendingWorkPriority = priorityLevel;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    implementation: portal.implementation,
  };
  return fiber;
}

function createFiberFromCoroutine(
  coroutine: ReactCoroutine,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  const fiber = createFiber(
    CoroutineComponent,
    coroutine.key,
    internalContextTag,
  );
  fiber.type = coroutine.handler;
  fiber.pendingProps = coroutine;
  fiber.pendingWorkPriority = priorityLevel;
  return fiber;
}

function coerceRef(current: Fiber | null, element: ReactElement) {
  let mixedRef = element.ref;
  if (mixedRef !== null && typeof mixedRef !== 'function') {
    if (element._owner) {
      const owner: ?(Fiber | ReactInstance) = (element._owner: any);
      let inst;
      if (owner) {
        if (typeof owner.tag === 'number') {
          const ownerFiber = ((owner: any): Fiber);
          inst = ownerFiber.stateNode;
        } else {
          // Stack
          inst = (owner: any).getPublicInstance();
        }
      }
      const stringRef = '' + mixedRef;
      // Check if previous string ref matches new string ref
      if (
        current !== null &&
        current.ref !== null &&
        current.ref._stringRef === stringRef
      ) {
        return current.ref;
      }
      const ref = function(value) {
        const refs = inst.refs === emptyObject ? (inst.refs = {}) : inst.refs;
        if (value === null) {
          delete refs[stringRef];
        } else {
          refs[stringRef] = value;
        }
      };
      ref._stringRef = stringRef;
      return ref;
    }
  }
  return mixedRef;
}

function shouldConstruct(Component) {
  return !!(Component.prototype && Component.prototype.isReactComponent);
}

function createFiberFromElementType(
  type: mixed,
  key: null | string,
  internalContextTag: TypeOfInternalContext,
  debugOwner: null | Fiber | ReactInstance,
): Fiber {
  let fiber;
  if (typeof type === 'function') {
    fiber = shouldConstruct(type)
      ? createFiber(ClassComponent, key, internalContextTag)
      : createFiber(IndeterminateComponent, key, internalContextTag);
    fiber.type = type;
  } else if (typeof type === 'string') {
    fiber = createFiber(HostComponent, key, internalContextTag);
    fiber.type = type;
  } else if (
    typeof type === 'object' &&
    type !== null &&
    typeof type.tag === 'number'
  ) {
    // Currently assumed to be a continuation and therefore is a fiber already.
    // TODO: The yield system is currently broken for updates in some cases.
    // The reified yield stores a fiber, but we don't know which fiber that is;
    // the current or a workInProgress? When the continuation gets rendered here
    // we don't know if we can reuse that fiber or if we need to clone it.
    // There is probably a clever way to restructure this.
    fiber = ((type: any): Fiber);
  } else {
  }
  return fiber;
}

function createFiberFromElement(
  element: ReactElement,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  let owner = null;
  if (__DEV__) {
    owner = element._owner;
  }

  const fiber = createFiberFromElementType(
    element.type,
    element.key,
    internalContextTag,
    owner,
  );
  fiber.pendingProps = element.props;
  fiber.pendingWorkPriority = priorityLevel;

  if (__DEV__) {
    fiber._debugSource = element._source;
    fiber._debugOwner = element._owner;
  }

  return fiber;
}

function createFiberFromFragment(
  elements: ReactFragment,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  // TODO: Consider supporting keyed fragments. Technically, we accidentally
  // support that in the existing React.
  const fiber = createFiber(Fragment, null, internalContextTag);
  fiber.pendingProps = elements;
  fiber.pendingWorkPriority = priorityLevel;
  return fiber;
}

function createFiberFromText(
  content: string,
  internalContextTag: TypeOfInternalContext,
  priorityLevel: PriorityLevel,
): Fiber {
  const fiber = createFiber(HostText, null, internalContextTag);
  fiber.pendingProps = content;
  fiber.pendingWorkPriority = priorityLevel;
  return fiber;
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

function getPublicRootInstance(
  container: OpaqueRoot
): ReactComponent<any, any, any> | I | TI | null {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  return containerFiber.child.stateNode;
}

function unbatchedUpdates<A>(fn: () => A): A {
  const previousIsBatchingUpdates = isBatchingUpdates;
  isBatchingUpdates = false;
  try {
    return fn();
  } finally {
    isBatchingUpdates = previousIsBatchingUpdates;
  }
}

function createHostRootFiber(): Fiber {
  const fiber = createFiber(HostRoot, null, NoContext);
  return fiber;
}

function createFiberRoot(containerInfo: any): FiberRoot {
  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  const uninitializedFiber = createHostRootFiber();
  const root = {
    current: uninitializedFiber,
    containerInfo: containerInfo,
    isScheduled: false,
    nextScheduledRoot: null,
    context: null,
    pendingContext: null,
  };
  uninitializedFiber.stateNode = root;
  return root;
}

function createContainer(containerInfo: C): OpaqueRoot {
  return createFiberRoot(containerInfo);
}

function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?ReactComponent<any, any, any>,
  callback: ?Function,
): void {
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
