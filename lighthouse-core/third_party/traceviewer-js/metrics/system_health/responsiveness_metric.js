/**
Copyright (c) 2015 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../../base/statistics.js");
require("../metric_registry.js");
require("./utils.js");
require("../../model/user_model/animation_expectation.js");
require("../../model/user_model/load_expectation.js");
require("../../model/user_model/response_expectation.js");
require("../../value/numeric.js");
require("../../value/value.js");

'use strict';

global.tr.exportTo('tr.metrics.sh', function() {
  // In the case of Response, Load, and DiscreteAnimation IRs, Responsiveness is
  // derived from the time between when the user thinks they begin an interation
  // (expectedStart) and the time when the screen first changes to reflect the
  // interaction (actualEnd).  There may be a delay between expectedStart and
  // when chrome first starts processing the interaction (actualStart) if the
  // main thread is busy.  The user doesn't know when actualStart is, they only
  // know when expectedStart is. User responsiveness, by definition, considers
  // only what the user experiences, so "duration" is defined as actualEnd -
  // expectedStart.

  function computeAnimationThroughput(animationExpectation) {
    if (animationExpectation.frameEvents === undefined ||
        animationExpectation.frameEvents.length === 0)
      throw new Error('Animation missing frameEvents ' +
                      animationExpectation.stableId);

    var durationSeconds = animationExpectation.duration / 1000;
    return animationExpectation.frameEvents.length / durationSeconds;
  }

  function computeAnimationframeTimeDiscrepancy(animationExpectation) {
    if (animationExpectation.frameEvents === undefined ||
        animationExpectation.frameEvents.length === 0)
      throw new Error('Animation missing frameEvents ' +
                      animationExpectation.stableId);

    var frameTimestamps = animationExpectation.frameEvents;
    frameTimestamps = frameTimestamps.toArray().map(function(event) {
      return event.start;
    });

    var absolute = false;
    return tr.b.Statistics.timestampsDiscrepancy(frameTimestamps, absolute);
  }

  var RESPONSE_NUMERIC_BUILDER = tr.v.NumericBuilder.createLinear(
      tr.v.Unit.byName.timeDurationInMs_smallerIsBetter,
      tr.b.Range.fromExplicitRange(100, 1000), 90);

  var THROUGHPUT_NUMERIC_BUILDER = tr.v.NumericBuilder.createLinear(
      tr.v.Unit.byName.unitlessNumber_biggerIsBetter,
      tr.b.Range.fromExplicitRange(10, 60), 10);

  var DISCREPANCY_NUMERIC_BUILDER = tr.v.NumericBuilder.createLinear(
      tr.v.Unit.byName.unitlessNumber_smallerIsBetter,
      tr.b.Range.fromExplicitRange(0, 1), 50);

  var LATENCY_NUMERIC_BUILDER = tr.v.NumericBuilder.createLinear(
      tr.v.Unit.byName.timeDurationInMs_smallerIsBetter,
      tr.b.Range.fromExplicitRange(0, 300), 60);

  /**
   * @param {!tr.v.ValueSet} values
   * @param {!tr.model.Model} model
   * @param {!Object=} opt_options
   */
  function responsivenessMetric(values, model, opt_options) {
    // TODO(benjhayden): Add categories to benchmark to support:
    // tr.metrics.sh.loadingMetric(values, model);

    var responseNumeric = RESPONSE_NUMERIC_BUILDER.build();
    var throughputNumeric = THROUGHPUT_NUMERIC_BUILDER.build();
    var frameTimeDiscrepancyNumeric = DISCREPANCY_NUMERIC_BUILDER.build();
    var latencyNumeric = LATENCY_NUMERIC_BUILDER.build();

    model.userModel.expectations.forEach(function(ue) {
      if (opt_options && opt_options.rangeOfInterest &&
          !opt_options.rangeOfInterest.intersectsExplicitRangeInclusive(
            ue.start, ue.end))
        return;

      var sampleDiagnostic = new tr.v.d.RelatedEventSet([ue]);

      // Responsiveness is not defined for Idle.
      if (ue instanceof tr.model.um.IdleExpectation) {
        return;
      } else if (ue instanceof tr.model.um.LoadExpectation) {
        // This is already covered by loadingMetric.
      } else if (ue instanceof tr.model.um.ResponseExpectation) {
        responseNumeric.add(ue.duration, sampleDiagnostic);
      } else if (ue instanceof tr.model.um.AnimationExpectation) {
        var throughput = computeAnimationThroughput(ue);
        if (throughput === undefined)
          throw new Error('Missing throughput for ' +
                          ue.stableId);

        throughputNumeric.add(throughput, sampleDiagnostic);

        var frameTimeDiscrepancy = computeAnimationframeTimeDiscrepancy(ue);
        if (frameTimeDiscrepancy === undefined)
          throw new Error('Missing frameTimeDiscrepancy for ' +
                          ue.stableId);

        frameTimeDiscrepancyNumeric.add(frameTimeDiscrepancy, sampleDiagnostic);

        ue.associatedEvents.forEach(function(event) {
          if (!(event instanceof tr.e.cc.InputLatencyAsyncSlice))
            return;

          latencyNumeric.add(event.duration, sampleDiagnostic);
        });
      } else {
        throw new Error('Unrecognized stage for ' + ue.stableId);
      }
    });

    [
      responseNumeric, throughputNumeric, frameTimeDiscrepancyNumeric,
      latencyNumeric
    ].forEach(function(numeric) {
      numeric.customizeSummaryOptions({
        avg: true,
        max: true,
        min: true,
        std: true
      });
    });

    values.addValue(new tr.v.NumericValue(
        'response latency', responseNumeric));
    values.addValue(new tr.v.NumericValue(
        'animation throughput', throughputNumeric));
    values.addValue(new tr.v.NumericValue(
        'animation frameTimeDiscrepancy',
        frameTimeDiscrepancyNumeric));
    values.addValue(new tr.v.NumericValue(
        'animation latency', latencyNumeric));
  }

  tr.metrics.MetricRegistry.register(responsivenessMetric, {
    supportsRangeOfInterest: true
  });

  return {
    responsivenessMetric: responsivenessMetric,
  };
});
