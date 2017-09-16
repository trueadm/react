"use strict";

const babylon = require('babylon');

const reactReduxConnectCode = `
function connect(mapStateToProps, mapDispatchToProps, mergeProps, _ref = {}) {
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
	
				if (process.env.NODE_ENV !== 'production') 
					verifyPlainObject(props, displayName, methodName)
	
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
	
					if (process.env.NODE_ENV !== 'production')
						verifyPlainObject(mergedProps, displayName, 'mergeProps')
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

	var initMapStateToProps = match(mapStateToProps, mapStateToPropsFactories, 'mapStateToProps');
	var initMapDispatchToProps = match(mapDispatchToProps, mapDispatchToPropsFactories, 'mapDispatchToProps');
	var initMergeProps = match(mergeProps, mergePropsFactories, 'mergeProps');

	return function(Component) {
		return Component;
	}
}
`;

const reactReduxConnect = babylon.parseExpression(reactReduxConnectCode, {
  plugins: ['flow'],
});

module.exports = {
	reactReduxConnect,
};
