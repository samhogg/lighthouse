/**
Copyright 2016 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../base/base.js");
require("../base/extension_registry.js");
require("../base/iteration_helpers.js");

'use strict';

global.tr.exportTo('tr.metrics', function() {

  function MetricRegistry() {}

  var options = new tr.b.ExtensionRegistryOptions(tr.b.BASIC_REGISTRY_MODE);
  options.defaultMetadata = {};
  tr.b.decorateExtensionRegistry(MetricRegistry, options);

  MetricRegistry.addEventListener('will-register', function(e) {
    var metric = e.typeInfo.constructor;
    if (!(metric instanceof Function))
      throw new Error('Metrics must be functions');

    if (metric.length < 2) {
      throw new Error('Metrics take a ValueSet and a Model and ' +
                      'optionally an options dictionary');
    }
  });

  return {
    MetricRegistry: MetricRegistry
  };
});
