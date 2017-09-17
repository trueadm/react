"use strict";

const babylon = require('babylon');

const reduxCreateStoreCode = `
function (reducer, preloadedState, enhancer) {
	const funcToString = Function.prototype.toString
	const hasOwnProperty = Object.prototype.hasOwnProperty
	const objectCtorString = funcToString.call(Object)
	const objectProto = Object.prototype
	const toString = objectProto.toString
	const symToStringTag = typeof Symbol != 'undefined' ? Symbol.toStringTag : undefined

	function baseGetTag(value) {
		if (value == null) {
			return value === undefined ? '[object Undefined]' : '[object Null]'
		}
		if (!(symToStringTag && symToStringTag in Object(value))) {
			return toString.call(value)
		}
		const isOwn = hasOwnProperty.call(value, symToStringTag)
		const tag = value[symToStringTag]
		let unmasked = false
		try {
			value[symToStringTag] = undefined
			unmasked = true
		} catch (e) {}
	
		const result = toString.call(value)
		if (unmasked) {
			if (isOwn) {
				value[symToStringTag] = tag
			} else {
				delete value[symToStringTag]
			}
		}
		return result
	}

	function isObjectLike(value) {
		return typeof value == 'object' && value !== null
	}
	
	function isPlainObject(value) {
		if (!isObjectLike(value) || baseGetTag(value) != '[object Object]') {
			return false
		}
		const proto = Object.getPrototypeOf(value)
		if (proto === null) {
			return true
		}
		const Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor
		return typeof Ctor == 'function' && Ctor instanceof Ctor &&
			funcToString.call(Ctor) == objectCtorString
	}

	function $$observable() {
		let result;
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
		return result;
	}

	const ActionTypes = {
		INIT: '@@redux/INIT'
	}

	if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }

    return enhancer(createStore)(reducer, preloadedState)
	}
	
  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.')
  }

  let currentReducer = reducer
  let currentState = preloadedState
  let currentListeners = []
  let nextListeners = currentListeners
  let isDispatching = false

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
		return currentState
	}
	
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.')
    }

    let isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
	}

  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
        'Use custom middleware for async actions.'
      )
    }

    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
        'Have you misspelled a constant?'
      )
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    const listeners = currentListeners = nextListeners
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action
	}
	
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer
    dispatch({ type: ActionTypes.INIT })
	}
	
  function observable() {
    const outerSubscribe = subscribe
    return {
      subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
`;

const reduxCreateStore = babylon.parseExpression(reduxCreateStoreCode, {
  plugins: ['flow'],
});

module.exports = {
	reduxCreateStore,
};
