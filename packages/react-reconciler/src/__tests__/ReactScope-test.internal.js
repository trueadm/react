/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

import {createEventTarget} from 'dom-event-testing-library';

let React;
let ReactFeatureFlags;

describe('ReactScope', () => {
  beforeEach(() => {
    jest.resetModules();
    ReactFeatureFlags = require('shared/ReactFeatureFlags');
    ReactFeatureFlags.enableScopeAPI = true;
    ReactFeatureFlags.enableDeprecatedFlareAPI = true;
    React = require('react');
  });

  describe('ReactDOM', () => {
    let ReactDOM;
    let container;

    beforeEach(() => {
      ReactDOM = require('react-dom');
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
      container = null;
    });

    it('DO_NOT_USE_queryAllNodes() works as intended', () => {
      const testScopeQuery = (type, props) => true;
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
          </>
        ) : (
          <>
            <a ref={aRef}>A</a>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
          </>
        );
      }

      ReactDOM.render(<Test toggle={true} />, container);
      let nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([divRef.current, spanRef.current, aRef.current]);
      ReactDOM.render(<Test toggle={false} />, container);
      nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([aRef.current, divRef.current, spanRef.current]);
      ReactDOM.render(null, container);
    });

    it('DO_NOT_USE_queryAllNodes() provides the correct host instance', () => {
      const testScopeQuery = (type, props) => type === 'div';
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
          </>
        ) : (
          <>
            <a ref={aRef}>A</a>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
          </>
        );
      }

      ReactDOM.render(<Test toggle={true} />, container);
      let nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([divRef.current]);
      let filterQuery = (type, props, instance) =>
        instance === spanRef.current || testScopeQuery(type, props);
      nodes = scope.DO_NOT_USE_queryAllNodes(filterQuery);
      expect(nodes).toEqual([divRef.current, spanRef.current]);
      filterQuery = (type, props, instance) =>
        [spanRef.current, aRef.current].includes(instance) ||
        testScopeQuery(type, props);
      nodes = scope.DO_NOT_USE_queryAllNodes(filterQuery);
      expect(nodes).toEqual([divRef.current, spanRef.current, aRef.current]);
      ReactDOM.render(<Test toggle={false} />, container);
      filterQuery = (type, props, instance) =>
        [spanRef.current, aRef.current].includes(instance) ||
        testScopeQuery(type, props);
      nodes = scope.DO_NOT_USE_queryAllNodes(filterQuery);
      expect(nodes).toEqual([aRef.current, divRef.current, spanRef.current]);
      ReactDOM.render(null, container);
    });

    it('DO_NOT_USE_queryFirstNode() works as intended', () => {
      const testScopeQuery = (type, props) => true;
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
          </>
        ) : (
          <>
            <a ref={aRef}>A</a>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
          </>
        );
      }

      ReactDOM.render(<Test toggle={true} />, container);
      let node = scope.DO_NOT_USE_queryFirstNode(testScopeQuery);
      expect(node).toEqual(divRef.current);
      ReactDOM.render(<Test toggle={false} />, container);
      node = scope.DO_NOT_USE_queryFirstNode(testScopeQuery);
      expect(node).toEqual(aRef.current);
      ReactDOM.render(null, container);
    });

    it('containsNode() works as intended', () => {
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      const outerSpan = React.createRef();
      const emRef = React.createRef();
      let scope;

      function Container({children}) {
        scope = React.unstable_useScope();
        return children;
      }

      function Test({toggle}) {
        return toggle ? (
          <div>
            <span ref={outerSpan}>SPAN</span>
            <Container>
              <div ref={divRef}>DIV</div>
              <span ref={spanRef}>SPAN</span>
              <a ref={aRef}>A</a>
            </Container>
            <em ref={emRef}>EM</em>
          </div>
        ) : (
          <div>
            <Container>
              <a ref={aRef}>A</a>
              <div ref={divRef}>DIV</div>
              <span ref={spanRef}>SPAN</span>
              <em ref={emRef}>EM</em>
            </Container>
            <span ref={outerSpan}>SPAN</span>
          </div>
        );
      }

      ReactDOM.render(<Test toggle={true} />, container);
      expect(scope.containsNode(divRef.current)).toBe(true);
      expect(scope.containsNode(spanRef.current)).toBe(true);
      expect(scope.containsNode(aRef.current)).toBe(true);
      expect(scope.containsNode(outerSpan.current)).toBe(false);
      expect(scope.containsNode(emRef.current)).toBe(false);
      ReactDOM.render(<Test toggle={false} />, container);
      expect(scope.containsNode(divRef.current)).toBe(true);
      expect(scope.containsNode(spanRef.current)).toBe(true);
      expect(scope.containsNode(aRef.current)).toBe(true);
      expect(scope.containsNode(outerSpan.current)).toBe(false);
      expect(scope.containsNode(emRef.current)).toBe(true);
      ReactDOM.render(<Test toggle={true} />, container);
      expect(scope.containsNode(emRef.current)).toBe(false);
    });

    it('scopes support server-side rendering and hydration', () => {
      const ReactDOMServer = require('react-dom/server');
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return (
          <div>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
            <div>Outside content!</div>
          </div>
        );
      }
      const html = ReactDOMServer.renderToString(<Test />);
      expect(html).toBe(
        '<div data-reactroot=""><div>DIV</div><span>SPAN</span><a>A</a><div>Outside content!</div></div>',
      );
      container.innerHTML = html;
      ReactDOM.hydrate(<Test />, container);
      const testScopeQuery = (type, props) =>
        props.children === 'DIV' ||
        props.children === 'SPAN' ||
        props.children === 'A';
      const nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([divRef.current, spanRef.current, aRef.current]);
    });

    it('getChildContextValues() works as intended', () => {
      const TestContext = React.createContext();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <TestContext.Provider value={1} />
          </>
        ) : (
          <>
            <TestContext.Provider value={1} />
            <TestContext.Provider value={2} />
          </>
        );
      }

      ReactDOM.render(<Test toggle={true} />, container);
      let nodes = scope.getChildContextValues(TestContext);
      expect(nodes).toEqual([1]);
      ReactDOM.render(<Test toggle={false} />, container);
      nodes = scope.getChildContextValues(TestContext);
      expect(nodes).toEqual([1, 2]);
      ReactDOM.render(null, container);
    });
  });

  describe('ReactTestRenderer', () => {
    let ReactTestRenderer;

    beforeEach(() => {
      ReactTestRenderer = require('react-test-renderer');
    });

    it('DO_NOT_USE_queryAllNodes() works as intended', () => {
      const testScopeQuery = (type, props) => true;
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
          </>
        ) : (
          <>
            <a ref={aRef}>A</a>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
          </>
        );
      }

      const renderer = ReactTestRenderer.create(<Test toggle={true} />, {
        createNodeMock: element => {
          return element;
        },
      });
      let nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([divRef.current, spanRef.current, aRef.current]);
      renderer.update(<Test toggle={false} />);
      nodes = scope.DO_NOT_USE_queryAllNodes(testScopeQuery);
      expect(nodes).toEqual([aRef.current, divRef.current, spanRef.current]);
    });

    it('DO_NOT_USE_queryFirstNode() works as intended', () => {
      const testScopeQuery = (type, props) => true;
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      let scope;

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
            <a ref={aRef}>A</a>
          </>
        ) : (
          <>
            <a ref={aRef}>A</a>
            <div ref={divRef}>DIV</div>
            <span ref={spanRef}>SPAN</span>
          </>
        );
      }

      const renderer = ReactTestRenderer.create(<Test toggle={true} />, {
        createNodeMock: element => {
          return element;
        },
      });
      let node = scope.DO_NOT_USE_queryFirstNode(testScopeQuery);
      expect(node).toEqual(divRef.current);
      renderer.update(<Test toggle={false} />);
      node = scope.DO_NOT_USE_queryFirstNode(testScopeQuery);
      expect(node).toEqual(aRef.current);
    });

    it('containsNode() works as intended', () => {
      const divRef = React.createRef();
      const spanRef = React.createRef();
      const aRef = React.createRef();
      const outerSpan = React.createRef();
      const emRef = React.createRef();
      let scope;

      function Container({children}) {
        scope = React.unstable_useScope();
        return children;
      }

      function Test({toggle}) {
        scope = React.unstable_useScope();

        return toggle ? (
          <div>
            <span ref={outerSpan}>SPAN</span>
            <Container>
              <div ref={divRef}>DIV</div>
              <span ref={spanRef}>SPAN</span>
              <a ref={aRef}>A</a>
            </Container>
            <em ref={emRef}>EM</em>
          </div>
        ) : (
          <div>
            <Container>
              <a ref={aRef}>A</a>
              <div ref={divRef}>DIV</div>
              <span ref={spanRef}>SPAN</span>
              <em ref={emRef}>EM</em>
            </Container>
            <span ref={outerSpan}>SPAN</span>
          </div>
        );
      }

      const renderer = ReactTestRenderer.create(<Test toggle={true} />, {
        createNodeMock: element => {
          return element;
        },
      });
      expect(scope.containsNode(divRef.current)).toBe(true);
      expect(scope.containsNode(spanRef.current)).toBe(true);
      expect(scope.containsNode(aRef.current)).toBe(true);
      expect(scope.containsNode(outerSpan.current)).toBe(false);
      expect(scope.containsNode(emRef.current)).toBe(false);
      renderer.update(<Test toggle={false} />);
      expect(scope.containsNode(divRef.current)).toBe(true);
      expect(scope.containsNode(spanRef.current)).toBe(true);
      expect(scope.containsNode(aRef.current)).toBe(true);
      expect(scope.containsNode(outerSpan.current)).toBe(false);
      expect(scope.containsNode(emRef.current)).toBe(true);
      renderer.update(<Test toggle={true} />);
      expect(scope.containsNode(emRef.current)).toBe(false);
    });
  });
});
