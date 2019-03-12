# React Flare + React Focal (draft v8)

## Introduction

This document contains early ideas on how we might extend React's event system to include high-level events that allow for consistent cross-device support. By offering these events, the idea is that engineers will be more inclined to fall into the pit of success when it comes to building UIs that work across different types of devices. The primary focus for React Flare/Focal is to enable rich events for FB www first and if they prove to be useful, they can be ported to other platforms (RN, VR etc) later.

Rather than have user-land components that achieve the same thing, these events are instead built into React's core. Having the events baked in allows for React to better optimize the event behaviour in collaboration with other parts of the framework. React's current event system is higly coupled, but that allows it to handle many edge-cases with its synthetic events and dispatching/batching system. React's scheduler ensures discrete events are properly handled in the correct order in concurrent mode – having event systems live outside of React can complicate this. Furthermore, having events in the core allows for performance optimizations (event delegation and recycling of event objects) and event replay in partial hydration. There are other benefits too – centralizing events in React allows for less code-duplication in user-land implementations.

Note: these new events would be behind a flag for FB internally.

## Problem

For example, if you wanted to create a new UI button for an application that would act as a primitive component (everyone should consume this component rather than directly using `<button>`), then one of the key features this component needs is properly handling of the different events that might come from mouse, keyboard, touch, stylus, pen etc.

Historically, someone might have done this:

```jsx
function Button(props) {
  function handleClick(e) {
    if (props.onClick) {
      props.onClick(e);
    }
  }

  return (
    <button onClick={handleClick}>{props.children}</button>
  );
}
```

Unfortunately, this means that this component has limited usability that isn't consistent across devices and platforms. If a user is using their finger to press the button, it might not register as a `click`, there might be delay in the `click` being fired or the `click` might never fire at all. One solution might be to try and work around all the different event edge cases and build a complex monolithic component that handles those cases. The main issue what that approach is that React doesn't provide a low-level surface to do this properly. As React doesn't provide such a surface, it means components generally end up bailing out of using React's built-in event system entirely. Bailing out of React's event system has its own sets of problems though:

- Discrete events will not properly flush the UI
- Non-descrete events will not properly batch together
- Concurrent rendering will not interop properly

## Solution

So rather than have a monolithic component that bails out of React's event system, there needs to be a way of consuming events via a low-level event surface. Furthermore, such surface needs a way of using React's event system so there's no need to bail out.

# Proposal

This proposal adds a new React event API, that consists of three parts:

- Event responder: a JS module that exposes an interface to specific React renderers
- Event component: a component that connects props to a single event responder
- Event hook: a hook that takes a responder, optional default props and returns an event componet

The only new public API would be a hook:

- `React.useEvent`

## Event Components

This proposal offers a way of creating event surfaces that respond to low-level enents. These surfaces are called "event responders", which a self-contained modules that expose an interface that can be consumed by components. Event responders can be created in user-space, but it should be expected that a handful of core event interactions should be shipped by the React core team as event responders. The core event responders are:

- Press (`react-events/press`)
- Hover (`react-events/hover`)
- Focus (`react-events/focus`)
- Swipe (`react-events/swipe`)
- Drag (`react-events/drag`)
- Pan (`react-events/pan`)

Each of these modules export an event component (along with an event responder definition). Event components can then be consumed in the render of a React component.

So in the case of the `Button` exampe above, rather than using `onClick`, a better approach would be to use the `Press` event component and the `onPress` prop. To make use of this event responder, an event component needs props that relate to the interface of the given event responder.

The `Press` event component can then be wrapped around what UI parts that need to be tracked for pressing interactivity:

```jsx
import Press from "react-events/press";

function Button(props) {
  function handlePress(e) {
    if (props.onClick) {
      props.onClick(e);
    }
  }

  return (
    <Press onPress={handlePress}>
      <button>{props.children}</button>
    </Press>
  );
}
```

The `Button` component works similarly to the previous example, except now the `<button>` now works cross-platform – mouse, touch, stylus and other input devices now work in a consistent manner. Furthermore, event responders can be used together to create rich experiences:

```jsx
import React, {useState} from 'react';
import Press from "react-events/press";
import Hover from "react-events/hover";

function PressableButton(props) {
  const [pressed, updatePressed] = useState(false);

  return (
    <Hover onHover={props.onHover}>
      <Press
        onPress={props.onPress}
        onPressChange={updatePressed}
      >
        <button tabIndex={0} role="button">{({pressed}) => props.children}</button>
      </Press>
    </Hover>
  );
}
```

`<Press>` and `<Hover>` are event components, imported from their respective modules. When the user triggers one of these events (for example, by clicking the `button`), the event components wrapping the element tell their event responders of an event taking place and take over the control of the event.

Events used directly on event components, like shown in the example above, work very much like events do with the existing event system. When an event is fired and picked up on a child component, the event component is notified of the event in order of the tree. This means that events that bubble will always traverse the tree from the child node to its parent. This behaviour makes for predictable behaviour when event components are nested (there is a 1:1 mapping between event component and the event listeners), as shown:

```jsx
// The onPress listener will fire with the order: fn3, fn2, fn1

<Press onPress={fn1}>
  <Press onPress={fn2}>
    <Press onPress={fn3}>
      <div>Press me</div>
    </Press>
  </Press>
</Press>
```

The event responder can take other props (for example `pressDelay`):

```jsx

function PressableButton({children}) {
  return (
    <Press onPress={...} pressDelay={200}>
      {children}
    </Press>
  );
}
```

## React.useEvent

This hook is somwhat similar to using event components directly from their modules, in that the hook form creates an "event component". For example:

```jsx
import {useEvent} from 'react';
import Press from "react-events/press";

function Button(props) {
  const ButtonPress = useEvent(Press);

  function handlePress(e) {
    if (props.onClick) {
      props.onClick(e);
    }
  }

  return (
    <ButtonPress onPress={handlePress}>
      <button>{props.children}</button>
    </ButtonPress>
  );
}
```

As you can see from the above, `useEvent` creates an event component, so there is overlap vs using the event component from the module directly. There is a core difference though: `useEvent` accepts a second argument allowing for hook props to be specified. This makes `useEvent` composable and re-usable in ways that offer applicability outside of being consumed in only primitive components. In product code, a `useFocus` hook can be created that provides a great way of finding if something is being focued:

```jsx
import {useFocus} from 'react-events/focus';

function MyProductComponent() {
  const [FocusEvent, isFocused] = useFocus();
  const className = isFocused ? "focus" : "default";

  return (
    <FocusEvent>
      <PrimitivePressableButton className={className} />
    </FocusEvent>
  );
}
```

Behind the scenes, this is how `useFocus` might be implemented using the second argument:

```jsx
import React, {useEvent, useState} from 'react';
import Focus from "react-events/focus";

export function useFocus() {
  const [isFocused, updateFocused] = useState(false);
  const hookProps = { onFocusChange: updateFocused };
  const FocusEvent = useEvent(Focus, hookProps);

  return [FocusEvent, isFocused];
}
```

It is also possible to chain event handlers created via hooks and those inlined. So in this case, both events will fire, starting with inline event handlers first, then hooks second:

```jsx
// these events will fire in the order: fn2, fn1
const hookProps = { onFocusChange: fn1 };
const FocusEvent = useEvent(Focus, hookProps);

return <FocusEvent onFocusChange={fn2}>...</FocusEvent>
```

## Touch Hit Target

An optional `TouchHitTarget` component exists on the `react-events` module.

```jsx
import TouchHitTarget from "react-events";
```

The `TouchHitTarget` property can be used as a component to expand the hit region for touch input, accepting the properties:

- `top`
- `right`
- `bottom`
- `left`

For example, this is how it could be used with the `PressableButton` example - with an additional 15px touch hit zone around the button:

```jsx
import React, {useState} from 'react';
import Press from "react-events/press";
import Hover from "react-events/hover";
import {TouchHitTarget} from "react-events";

function PressableButton(props) {
  const [pressed, updatePressed] = useState(false);

  return (
    <Hover onHover={props.onHover}>
      <Press
        onPress={props.onPress}
        onPressChange={updatePressed}
      >
        <TouchHitTarget top={15} right={15} bottom={15} left={15}>
          <button tabIndex={0} role="button">{({pressed}) => props.children}</button>
        </TouchHitTarget>
      </Press>
    </Hover>
  );
}
```

There are a few constaints to using `TouchHitTarget`:

- can only have a single child
- must always be directly within an event component
- must be the only child of an event component

```jsx

// Invalid
<div>
  <TouchHitTarget>
    <div />
  </TouchHitTarget>
</div>

// Invalid
<SomeEvent>
  <TouchHitTarget>
    <TouchHitTarget>
      <div />
    <TouchHitTarget>
  </TouchHitTarget>
<SomeEvent>

// Invalid
<SomeEvent>
  <div>
    <TouchHitTarget>
      <div />
    </TouchHitTarget>
  </div>
</SomeEvent>

// Invalid
<SomeEvent>
  <TouchHitTarget>
    <div />
    <div />
  </TouchHitTarget>
</SomeEvent>

// Invalid
<SomeEvent>
  <TouchHitTarget>
    <div />
  </TouchHitTarget>
  <TouchHitTarget>
    <div />
  </TouchHitTarget>
</SomeEvent>

// Valid
<SomeEvent>
  <TouchHitTarget>
    <div />
  </TouchHitTarget>
</SomeEvent>
<SomeEvent>
  <TouchHitTarget>
    <div />
  </TouchHitTarget>
</SomeEvent>
```

# Event Responders

Event responders, like that offered by the `react-events/press` module, will intentionally live outside of React and sit in user-space. This provides some useful benefits:

- Event responders aren't loaded until they're needed. If a component doesn't use a specific event, the cost for that event responder is not paid.
- Event responders can be versioned independently from React and exist in product code for easier A/B testing and experimentation.
- Event responders provide low-level access to React's event batching and dispatching system –- something not available using the current event system.
- Event responders could replace large chunks of ReactDOM's internal event plugin system, saving bytes from the ReactDOM bundle.

## Event Responder API

Event responders are the core of how the new event system works. All event components hand-off events to the respective event responders. It's up to the event responders to decide what should happen when a given event occurs (if anything). Event responders can be thought of as state machines (they have their own local state) for controlling the flow of many events, the creation of synthetic events and also the handling of ownership (in relation to other event responders).

```jsx
type EventResponder {
  targetEventTypes: Array<string>,
  createInitialState(props) => Object,
  handleEvent(context: Object, props: Object, state: Object) => void,
}
```

For example, a very basic implementation that listens for `mouse` events might look like this:

```jsx
// This event responder provides support for:
// - onMouseDown/onMouseUp (passive)
// - onMouseDownActive/onMouseUpActive (non-passive)

const ExampleResponder = {
  // These are the top level event types that the React renderer listens to.
  // By default the new events API listens for both passive and non-passive events
  // for each type. These events will only trigger the `handleEvent` callback
  // if the event occurs on a child event target.
  targetEventTypes: ['mousedown'],

  // State is created for on the component instance. This isn't global or shared state.
  createInitialState() {
    return {
      isMouseDown: false,
    };
  }

  handleEvent(context, props, state) {
    if (context.eventType === 'mouseup') {
      if (state.isMouseDown) {
        state.isMouseDown = false;
        // We listen on the root of the document for mouseup
        context.removeRootEventTypes(['mouseup']);
      }

      if (props.onMouseUp && context.isPassive) {
        context.dispatchBubbledEvent(
          'mouseup',
          props.onMouseUp,
          context.eventTarget,
        );
      } else if (props.onMouseUpActive && context.isPassive) {
        context.dispatchBubbledEvent(
          'mouseup',
          props.onMouseUpActive,
          context.eventTarget,
        );
      }
    } else if (context.eventType === 'mousedown') {
      if (!state.isMouseDown) {
        state.isMouseDown = true;
        // We listen on the root of the document for mouseup
        // We need to listen on the root, as the mouseup
        // might not occur on a child event target.
        context.addRootEventTypes(['mouseup']);
      }

      if (props.onMouseDown && context.isPassive) {
        context.dispatchBubbledEvent(
          'mousedown',
          props.onMouseDown,
          context.eventTarget,
        );
      } else if (props.onMouseDownActive && context.isPassive) {
        context.dispatchBubbledEvent(
          'mousedown',
          props.onMouseDownActive,
          context.eventTarget,
        );
      }
    }
  }
};

export default ExampleResponder;
```
