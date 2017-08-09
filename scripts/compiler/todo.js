

function assert(condition) {
  if (!condition) {
    throw new Error('assertion failed');
  }
}

// Initialize example module



let exampleModule = new evaluator.ModuleEnvironment();

let staticThing = ast.program.body[0].declarations[0].init;
let FooAst = ast.program.body[1];
assert(FooAst.type === 'FunctionDeclaration');
let BarAst = ast.program.body[2];
assert(BarAst.type === 'FunctionDeclaration');
let BazAst = ast.program.body[3];
assert(BazAst.type === 'FunctionDeclaration');

let StaticThing = exampleModule.eval(staticThing);
let Foo = exampleModule.eval(FooAst);
let Bar = exampleModule.eval(BarAst);
let Baz = exampleModule.eval(BazAst);

exampleModule.declare('staticThing', StaticThing);
exampleModule.declare('Foo', Foo);
exampleModule.declare('Bar', Bar);
exampleModule.declare('Baz', Baz);

let initialProps = evaluator.createAbstractObject('props');

let resolvedResult = reconciler.renderAsDeepAsPossible(
  Foo,
  initialProps
);

let expression = serializer.serializeEvaluatedFunction(Foo, [initialProps], resolvedResult);

console.log(generate(expression).code);
