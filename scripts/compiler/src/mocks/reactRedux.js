"use strict";

const babylon = require('babylon');

const reactReduxConnectCode = `
function (mapStateToProps, mapDispatchToProps, mergeProps, _ref = {}) {
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
	function is(x, y) {
		if (x === y) {
			return x !== 0 || y !== 0 || 1 / x === 1 / y
		} else {
			return x !== x && y !== y
		}
	}
	function shallowEqual(objA, objB) {
		if (is(objA, objB)) return true
	
		if (typeof objA !== 'object' || objA === null ||
				typeof objB !== 'object' || objB === null) {
			return false
		}
	
		const keysA = Object.keys(objA)
		const keysB = Object.keys(objB)
	
		if (keysA.length !== keysB.length) return false
	
		for (let i = 0; i < keysA.length; i++) {
			if (!hasOwn.call(objB, keysA[i]) ||
					!is(objA[keysA[i]], objB[keysA[i]])) {
				return false
			}
		}
	
		return true
	}
	function match(arg, factories, name) {
		for (let i = factories.length - 1; i >= 0; i--) {
			const result = factories[i](arg)
			if (result) return result
		}
	
		return (dispatch, options) => {
			throw new Error(\`Invalid value of type \${typeof arg} for \${name} argument when connecting component \${options.wrappedComponentName}.\`)
		}
	}
	function verifyPlainObject(value, displayName, methodName) {
		if (!isPlainObject(value)) {
			warning(
				\`\${methodName}() in \${displayName} must return a plain object. Instead received \${value}.\`
			)
		}
	}
	function wrapMapToPropsFunc(mapToProps, methodName) {
		return function initProxySelector(dispatch, { displayName }) {
			const proxy = function mapToPropsProxy(stateOrDispatch, ownProps) {
				return proxy.dependsOnOwnProps
					? proxy.mapToProps(stateOrDispatch, ownProps)
					: proxy.mapToProps(stateOrDispatch)
			}
	
			// allow detectFactoryAndVerify to get ownProps
			proxy.dependsOnOwnProps = true
	
			proxy.mapToProps = function detectFactoryAndVerify(stateOrDispatch, ownProps) {
				proxy.mapToProps = mapToProps
				proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps)
				let props = proxy(stateOrDispatch, ownProps)
	
				if (typeof props === 'function') {
					proxy.mapToProps = props
					proxy.dependsOnOwnProps = getDependsOnOwnProps(props)
					props = proxy(stateOrDispatch, ownProps)
				}
	
				return props
			}
	
			return proxy
		}
	}
	function wrapMapToPropsConstant(getConstant) {
		return function initConstantSelector(dispatch, options) {
			const constant = getConstant(dispatch, options)
	
			function constantSelector() { return constant }
			constantSelector.dependsOnOwnProps = false 
			return constantSelector
		}
	}
	function whenMapDispatchToPropsIsFunction(mapDispatchToProps) {
		return (typeof mapDispatchToProps === 'function')
			? wrapMapToPropsFunc(mapDispatchToProps, 'mapDispatchToProps')
			: undefined
	}
	function whenMapDispatchToPropsIsMissing(mapDispatchToProps) {
		return (!mapDispatchToProps)
			? wrapMapToPropsConstant(dispatch => ({ dispatch }))
			: undefined
	}
	function whenMapDispatchToPropsIsObject(mapDispatchToProps) {
		return (mapDispatchToProps && typeof mapDispatchToProps === 'object')
			? wrapMapToPropsConstant(dispatch => bindActionCreators(mapDispatchToProps, dispatch))
			: undefined
	}
	function whenMapStateToPropsIsFunction(mapStateToProps) {
		return (typeof mapStateToProps === 'function')
			? wrapMapToPropsFunc(mapStateToProps, 'mapStateToProps')
			: undefined
	}
	
	function whenMapStateToPropsIsMissing(mapStateToProps) {
		return (!mapStateToProps)
			? wrapMapToPropsConstant(() => ({}))
			: undefined
	}
	function defaultMergeProps(stateProps, dispatchProps, ownProps) {
		var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };
		return _extends({}, ownProps, stateProps, dispatchProps);
	}
	function wrapMergePropsFunc(mergeProps) {
		return function initMergePropsProxy(
			dispatch, { displayName, pure, areMergedPropsEqual }
		) {
			let hasRunOnce = false
			let mergedProps
	
			return function mergePropsProxy(stateProps, dispatchProps, ownProps) {
				const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps)
	
				if (hasRunOnce) {
					if (!pure || !areMergedPropsEqual(nextMergedProps, mergedProps))
						mergedProps = nextMergedProps
	
				} else {
					hasRunOnce = true
					mergedProps = nextMergedProps
				}
	
				return mergedProps
			}
		}
	}
	function whenMergePropsIsFunction(mergeProps) {
		return (typeof mergeProps === 'function')
			? wrapMergePropsFunc(mergeProps)
			: undefined
	}
	function whenMergePropsIsOmitted(mergeProps) {
		return (!mergeProps)
			? () => defaultMergeProps
			: undefined
	}
	var mapDispatchToPropsFactories = [
		whenMapDispatchToPropsIsFunction,
		whenMapDispatchToPropsIsMissing,
		whenMapDispatchToPropsIsObject,
	];
	var mapStateToPropsFactories = [
		whenMapStateToPropsIsFunction,
		whenMapStateToPropsIsMissing,
	];
	var mergePropsFactories = [
		whenMergePropsIsFunction,
		whenMergePropsIsOmitted
	];
	function strictEqual(a, b) { return a === b }
	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };		
	function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }
	var {
		pure = true,
		areStatesEqual = strictEqual,
		areOwnPropsEqual = shallowEqual,
		areStatePropsEqual = shallowEqual,
		areMergedPropsEqual = shallowEqual
	} = _ref,
	extraOptions = _objectWithoutProperties(_ref, ['pure', 'areStatesEqual', 'areOwnPropsEqual', 'areStatePropsEqual', 'areMergedPropsEqual']);
	function pureFinalPropsSelectorFactory(
		mapStateToProps,
		mapDispatchToProps,
		mergeProps,
		dispatch,
		{ areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
	) {
		let hasRunAtLeastOnce = false
		let state
		let ownProps
		let stateProps
		let dispatchProps
		let mergedProps
	
		function handleFirstCall(firstState, firstOwnProps) {
			state = firstState
			ownProps = firstOwnProps
			stateProps = mapStateToProps(state, ownProps)
			dispatchProps = mapDispatchToProps(dispatch, ownProps)
			mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
			hasRunAtLeastOnce = true
			return mergedProps
		}
	
		function handleNewPropsAndNewState() {
			stateProps = mapStateToProps(state, ownProps)
	
			if (mapDispatchToProps.dependsOnOwnProps)
				dispatchProps = mapDispatchToProps(dispatch, ownProps)
	
			mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
			return mergedProps
		}
	
		function handleNewProps() {
			if (mapStateToProps.dependsOnOwnProps)
				stateProps = mapStateToProps(state, ownProps)
	
			if (mapDispatchToProps.dependsOnOwnProps)
				dispatchProps = mapDispatchToProps(dispatch, ownProps)
	
			mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
			return mergedProps
		}
	
		function handleNewState() {
			const nextStateProps = mapStateToProps(state, ownProps)
			const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps)
			stateProps = nextStateProps
			
			if (statePropsChanged)
				mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
	
			return mergedProps
		}
	
		function handleSubsequentCalls(nextState, nextOwnProps) {
			const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
			const stateChanged = !areStatesEqual(nextState, state)
			state = nextState
			ownProps = nextOwnProps
	
			if (propsChanged && stateChanged) return handleNewPropsAndNewState()
			if (propsChanged) return handleNewProps()
			if (stateChanged) return handleNewState()
			return mergedProps
		}
	
		return function pureFinalPropsSelector(nextState, nextOwnProps) {
			return hasRunAtLeastOnce
				? handleSubsequentCalls(nextState, nextOwnProps)
				: handleFirstCall(nextState, nextOwnProps)
		}
	}
	function impureFinalPropsSelectorFactory(
		mapStateToProps,
		mapDispatchToProps,
		mergeProps,
		dispatch
	) {
		return function impureFinalPropsSelector(state, ownProps) {
			return mergeProps(
				mapStateToProps(state, ownProps),
				mapDispatchToProps(dispatch, ownProps),
				ownProps
			)
		}
	}
	function selectorFactory(dispatch, _ref) {
		var {
			initMapStateToProps,
			initMapDispatchToProps,
			initMergeProps
		} = _ref,
				options = _objectWithoutProperties(_ref, ['initMapStateToProps', 'initMapDispatchToProps', 'initMergeProps']);
	
		const mapStateToProps = initMapStateToProps(dispatch, options);
		const mapDispatchToProps = initMapDispatchToProps(dispatch, options);
		const mergeProps = initMergeProps(dispatch, options);
	
		const selectorFactory = options.pure ? pureFinalPropsSelectorFactory : impureFinalPropsSelectorFactory;
	
		return selectorFactory(mapStateToProps, mapDispatchToProps, mergeProps, dispatch, options);
	}
	var defineProperty = Object.defineProperty;
	var getOwnPropertyNames = Object.getOwnPropertyNames;
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
	var getPrototypeOf = Object.getPrototypeOf;
	var objectPrototype = getPrototypeOf && getPrototypeOf(Object);
	var REACT_STATICS = {
			childContextTypes: true,
			contextTypes: true,
			defaultProps: true,
			displayName: true,
			getDefaultProps: true,
			mixins: true,
			propTypes: true,
			type: true
	};

	var KNOWN_STATICS = {
		name: true,
		length: true,
		prototype: true,
		caller: true,
		callee: true,
		arguments: true,
		arity: true
	};
	function hoistStatics(targetComponent, sourceComponent, blacklist) {
    if (typeof sourceComponent !== 'string') { // don't hoist over string (html) components

        if (objectPrototype) {
            var inheritedComponent = getPrototypeOf(sourceComponent);
            if (inheritedComponent && inheritedComponent !== objectPrototype) {
							hoistStatics(targetComponent, inheritedComponent, blacklist);
            }
        }

        var keys = getOwnPropertyNames(sourceComponent);

        if (getOwnPropertySymbols) {
            keys = keys.concat(getOwnPropertySymbols(sourceComponent));
        }

        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (!REACT_STATICS[key] && !KNOWN_STATICS[key] && (!blacklist || !blacklist[key])) {
                var descriptor = getOwnPropertyDescriptor(sourceComponent, key);
                try { // Avoid failures from read-only properties
                    defineProperty(targetComponent, key, descriptor);
                } catch (e) {}
            }
        }

        return targetComponent;
    }

    return targetComponent;
};
	var dummyState = {}
	function noop() {}
	function makeSelectorStateful(sourceSelector, store) {
		const selector = {
			run: function runComponentSelector(props) {
				try {
					const nextProps = sourceSelector(store.getState(), props)
					if (nextProps !== selector.props || selector.error) {
						selector.shouldComponentUpdate = true
						selector.props = nextProps
						selector.error = null
					}
				} catch (error) {
					selector.shouldComponentUpdate = true
					selector.error = error
				}
			}
		}
	
		return selector
	}
	var CLEARED = null
	var nullListeners = { notify() {} }
	function createListenerCollection() {
		// the current/next pattern is copied from redux's createStore code.
		// TODO: refactor+expose that code to be reusable here?
		let current = []
		let next = []
	
		return {
			clear() {
				next = CLEARED
				current = CLEARED
			},
	
			notify() {
				const listeners = current = next
				for (let i = 0; i < listeners.length; i++) {
					listeners[i]()
				}
			},
	
			get() {
				return next
			},
	
			subscribe(listener) {
				let isSubscribed = true
				if (next === current) next = current.slice()
				next.push(listener)
	
				return function unsubscribe() {
					if (!isSubscribed || current === CLEARED) return
					isSubscribed = false
	
					if (next === current) next = current.slice()
					next.splice(next.indexOf(listener), 1)
				}
			}
		}
	}
	var Subscription = class {
		constructor(store, parentSub, onStateChange) {
			this.store = store
			this.parentSub = parentSub
			this.onStateChange = onStateChange
			this.unsubscribe = null
			this.listeners = nullListeners
		}
	
		addNestedSub(listener) {
			this.trySubscribe()
			return this.listeners.subscribe(listener)
		}
	
		notifyNestedSubs() {
			this.listeners.notify()
		}
	
		isSubscribed() {
			return Boolean(this.unsubscribe)
		}
	
		trySubscribe() {
			if (!this.unsubscribe) {
				this.unsubscribe = this.parentSub
					? this.parentSub.addNestedSub(this.onStateChange)
					: this.store.subscribe(this.onStateChange)
	 
				this.listeners = createListenerCollection()
			}
		}
	
		tryUnsubscribe() {
			if (this.unsubscribe) {
				this.unsubscribe()
				this.unsubscribe = null
				this.listeners.clear()
				this.listeners = nullListeners
			}
		}
	}
	function connectHOC(
		selectorFactory,
		_ref = {}) {
			var {
				getDisplayName = name => \`ConnectAdvanced(\${name})\`,
				methodName = 'connectAdvanced',
				renderCountProp = undefined,
				shouldHandleStateChanges = true,
				storeKey = 'store',
				withRef = false
			} = _ref,
			connectOptions = _objectWithoutProperties(_ref, ['getDisplayName', 'methodName', 'renderCountProp', 'shouldHandleStateChanges', 'storeKey', 'withRef']);
		
			var subscriptionKey = storeKey + 'Subscription';
		
			return function wrapWithConnect(WrappedComponent) {

				var wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
		
				var displayName = getDisplayName(wrappedComponentName);
		
				var selectorFactoryOptions = _extends({}, connectOptions, {
					getDisplayName,
					methodName,
					renderCountProp,
					shouldHandleStateChanges,
					storeKey,
					withRef,
					displayName,
					wrappedComponentName,
					WrappedComponent
				});
		
				var Connect = class extends React.Component {
					constructor(props, context) {
						super(props, context);
						this.state = {};
						this.renderCount = 0;
						this.store = props[storeKey] || context[storeKey];
						this.propsMode = Boolean(props[storeKey]);
						this.setWrappedInstance = this.setWrappedInstance.bind(this);
						this.initSelector();
						this.initSubscription();
					}
		
					getChildContext() {
						const subscription = this.propsMode ? null : this.subscription;
						return { [subscriptionKey]: subscription || this.context[subscriptionKey] };
					}
		
					componentDidMount() {
						if (!shouldHandleStateChanges) return;
						this.subscription.trySubscribe();
						this.selector.run(this.props);
						if (this.selector.shouldComponentUpdate) this.forceUpdate();
					}
		
					componentWillReceiveProps(nextProps) {
						this.selector.run(nextProps);
					}
		
					shouldComponentUpdate() {
						return this.selector.shouldComponentUpdate;
					}
		
					componentWillUnmount() {
						if (this.subscription) this.subscription.tryUnsubscribe();
						this.subscription = null;
						this.notifyNestedSubs = noop;
						this.store = null;
						this.selector.run = noop;
						this.selector.shouldComponentUpdate = false;
					}
		
					getWrappedInstance() {
						return this.wrappedInstance;
					}
		
					setWrappedInstance(ref) {
						this.wrappedInstance = ref;
					}
		
					initSelector() {
						const sourceSelector = selectorFactory(this.store.dispatch, selectorFactoryOptions);
						this.selector = makeSelectorStateful(sourceSelector, this.store);
						this.selector.run(this.props);
					}
		
					initSubscription() {
						if (!shouldHandleStateChanges) return;
						const parentSub = (this.propsMode ? this.props : this.context)[subscriptionKey];
						this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this));
						this.notifyNestedSubs = this.subscription.notifyNestedSubs.bind(this.subscription);
					}
		
					onStateChange() {
						this.selector.run(this.props);
		
						if (!this.selector.shouldComponentUpdate) {
							this.notifyNestedSubs();
						} else {
							this.componentDidUpdate = this.notifyNestedSubsOnComponentDidUpdate;
							this.setState({dummyState});
						}
					}
		
					notifyNestedSubsOnComponentDidUpdate() {
						this.componentDidUpdate = undefined;
						this.notifyNestedSubs();
					}
		
					isSubscribed() {
						return Boolean(this.subscription) && this.subscription.isSubscribed();
					}
		
					addExtraProps(props) {
						const withExtras = _extends({}, props);
						if (withRef) withExtras.ref = this.setWrappedInstance;
						if (renderCountProp) withExtras[renderCountProp] = this.renderCount++;
						if (this.propsMode && this.subscription) withExtras[subscriptionKey] = this.subscription;
						return withExtras;
					}
		
					render() {
						const selector = this.selector;
						selector.shouldComponentUpdate = false;
		
						if (selector.error) {
							throw selector.error;
						} else {
							return <WrappedComponent {...this.addExtraProps(selector.props)} />;
						}
					}
				}
		
				Connect.WrappedComponent = WrappedComponent;
				Connect.displayName = displayName;
		
				return Connect;
			};
		}

	var initMapStateToProps = match(mapStateToProps, mapStateToPropsFactories, 'mapStateToProps');
	var initMapDispatchToProps = match(mapDispatchToProps, mapDispatchToPropsFactories, 'mapDispatchToProps');
	var initMergeProps = match(mergeProps, mergePropsFactories, 'mergeProps');

	return connectHOC(selectorFactory, _extends({
		methodName: 'connect',
		getDisplayName: name => \`Connect(\${name})\`,
		shouldHandleStateChanges: Boolean(mapStateToProps),
		initMapStateToProps,
		initMapDispatchToProps,
		initMergeProps,
		pure,
		areStatesEqual,
		areOwnPropsEqual,
		areStatePropsEqual,
		areMergedPropsEqual

	}, extraOptions));
}
`;

const reactReduxConnect = babylon.parseExpression(reactReduxConnectCode, {
  plugins: ['flow', 'jsx'],
});

module.exports = {
	reactReduxConnect,
};
