/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const onPressImpl = {
  listenTo: ['onKeyPress', 'onClick'],
  extractEvents() {

  },
};

export function onPress(config) {
  return {
    config,
    impl: onPressImpl,
  };
}
onPress.config = {};
onPress.impl = onPressImpl;
