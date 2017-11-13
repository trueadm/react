/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type TypeOfWork = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const IndeterminateComponent = 0; // Before we know whether it is functional or class
export const FunctionalComponent = 1;
export const ClassComponent = 2;
export const StatefulFunctionalComponent = 3;
export const HostRoot = 4; // Root of a host tree. Could be nested inside another node.
export const HostPortal = 5; // A subtree. Could be an entry point to a different renderer.
export const HostComponent = 6;
export const HostText = 7;
export const CallComponent = 8;
export const CallHandlerPhase = 9;
export const ReturnComponent = 10;
export const Fragment = 11;
