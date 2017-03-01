(function() {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var ReactDOMFiber = window.ReactDOMFiber;
  var app = document.getElementById('app');

  document.getElementById('functional').onclick = function() {
    var start = performance.now();
    ReactDOM.render(React.createElement(window.functionBenchmark, null), app);
    var render = performance.now() - start;
    setTimeout(function() {
      var total = performance.now() - start;
      alert('Functional Benchmark - Stack\n\nRender: ' + render + ' ms\nTotal: ' + total + ' ms');
      ReactDOM.unmountComponentAtNode(app);
      app.textContent = null;
    }, 0);
  };
  document.getElementById('functional-fiber').onclick = function() {
    var start = performance.now();
    ReactDOMFiber.render(React.createElement(window.functionBenchmark, null), app);
    var render = performance.now() - start;
    setTimeout(function() {
      var total = performance.now() - start;
      alert('Functional Benchmark - Fiber\n\nRender: ' + render + ' ms\nTotal: ' + total + ' ms');
      ReactDOMFiber.unmountComponentAtNode(app);
      app.textContent = null;
    }, 0);
  };
})();
