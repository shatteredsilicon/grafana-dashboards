/// <reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';

import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import { MetricsPanelCtrl, PanelCtrl } from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';

class SSMRangeStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  series: any[];
  data: any;
  unitFormats: any[];
  panel: any;
  events: any;
  tableColumnOptions: any;

  // Set and populate defaults
  panelDefaults = {
    links: [],
    datasource: null,
    maxDataPoints: 100,
    interval: null,
    targets: [{}],
    cacheTimeout: null,
    format: 'none',
    nullText: null,
    valueMaps: [{ value: 'null', op: '=', text: 'N/A' }],
    mappingTypes: [{ name: 'value to text', value: 1 }, { name: 'range to text', value: 2 }],
    rangeMaps: [{ from: 'null', to: 'null', text: 'N/A' }],
    mappingType: 1
  };

  /** @ngInject */
  constructor($scope, $injector, private $location, private linkSrv) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/ssm-rangestat-panel/editor.html', 2);
    this.addEditorTab('Value Mappings', 'public/plugins/ssm-rangestat-panel/mappings.html', 3);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  onDataError(err) {
    this.onDataReceived([]);
  }

  onDataReceived(dataList) {
    const data: any = {};
    this.series = _.uniqBy(dataList, s => s.refId);
    this.setValues(data);
    this.data = data;
    this.render();
  }

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints || [],
      alias: seriesData.target
    });

    series.refId = seriesData.refId;
    return series;
  }

  setTableColumnToSensibleDefault(tableData) {
    if (this.tableColumnOptions.length === 1) {
      this.panel.tableColumn = this.tableColumnOptions[0];
    } else {
      this.panel.tableColumn = _.find(tableData.columns, col => {
        return col.type !== 'time';
      }).text;
    }
  }

  getDecimalsForValue(value) {
    if (_.isNumber(this.panel.decimals)) {
      return { decimals: this.panel.decimals, scaledDecimals: null };
    }

    var delta = value / 2;
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    var magn = Math.pow(10, -dec),
      norm = delta / magn, // norm is between 1.0 and 10.0
      size;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) {
      dec = 0;
    }

    var result: any = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;
    return result;
  }

  setValues(data) {
    data.roundValues = [];
    data.values = [];
    data.formattedValues = [];

    for (const series of this.series) {
      var lastPoint = _.last(series.datapoints);
      var lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      if (_.isString(lastValue)) {
        data.values.push(0);
        data.roundValues.push(0);
        data.formattedValues.push(_.escape(lastValue));
      } else {
        data.values.push(lastValue);

        var decimalInfo = this.getDecimalsForValue(lastValue);
        var formatFunc = kbn.valueFormats[this.panel.format];
        data.formattedValues.push(formatFunc(lastValue, decimalInfo.decimals, decimalInfo.scaledDecimals));
        data.roundValues.push(kbn.roundValue(lastValue, decimalInfo.decimals));
      }
    }

    data.scopedVars = _.extend({}, this.panel.scopedVars);
    this.setValueMapping(data);
  }

  setValueMapping(data) {
    if (this.panel.mappingType === 1) {
      for (var i = 0; i < this.panel.valueMaps.length; i++) {
        var map = this.panel.valueMaps[i];

        if (map.value === 'null' && !data.values.length) {
          data.values = [null];
          data.roundValues = [null];
          data.formattedValues = [map.text];
          return;
        }
  
        for (let i = 0; i < this.series.length; i++) {
          // special null case
          if (map.value === 'null') {
            if (data.values[i] === null || data.values[i] === void 0) {
              data.formattedValues[i] = map.text;
            }
            continue;
          }
  
          // value/number to text mapping
          var value = parseFloat(map.value);
          if (value === data.roundValues[i]) {
            data.formattedValues[i] = map.text;
            continue;
          }
        }
      }
    } else if (this.panel.mappingType === 2) {
      for (var i = 0; i < this.panel.rangeMaps.length; i++) {
        var map = this.panel.rangeMaps[i];

        if (map.from === 'null' && map.to === 'null' && !data.values.length) {
          data.values = [null];
          data.roundValues = [null];
          data.formattedValues = [map.text];
          return;
        }
  
        for (let i = 0; i < this.series.length; i++) {
          // special null case
          if (map.from === 'null' && map.to === 'null') {
            if (data.values[i] === null || data.values[i] === void 0) {
              data.formattedValues[i] = map.text;
            }
            continue;
          }
  
          // value/number to text mapping
          var from = parseFloat(map.from);
          var to = parseFloat(map.to);
          if (to >= data.roundValues[i] && from <= data.roundValues[i]) {
            data.formattedValues[i] = map.text;
            continue;
          }
        }
      }
    }

    //Check data value
    for (var i = 0; i < this.series.length; i++) {
      if (data.values[i] === null || data.values[i] === void 0) {
        data.formattedValues[i] = 'no value';
      }
    }
  }

  removeValueMap(map) {
    var index = _.indexOf(this.panel.valueMaps, map);
    this.panel.valueMaps.splice(index, 1);
    this.render();
  }

  addValueMap() {
    this.panel.valueMaps.push({ value: '', op: '=', text: '' });
  }

  removeRangeMap(rangeMap) {
    var index = _.indexOf(this.panel.rangeMaps, rangeMap);
    this.panel.rangeMaps.splice(index, 1);
    this.render();
  }

  addRangeMap() {
    this.panel.rangeMaps.push({ from: '', to: '', text: '' });
  }

  link(scope, elem, attrs, ctrl) {
    var $location = this.$location;
    var linkSrv = this.linkSrv;
    var $timeout = this.$timeout;
    var panel = ctrl.panel;
    var templateSrv = this.templateSrv;
    var data, linkInfo;
    elem = elem.find('.ssm-rangestat-panel');

    function setBigValueHtml() {
      const initialHeight = elem.height();
      const initialWidth = elem.width();

      let content = 'N/A';
      if (data.formattedValues.length > 1 && data.formattedValues[0] !== data.formattedValues[1]) {
        let firstIndex = data.formattedValues[0].lastIndexOf(' ');
        let secondIndex = data.formattedValues[1].lastIndexOf(' ');
        if (firstIndex !== -1 && secondIndex !== -1 && data.formattedValues[0].slice(firstIndex) === data.formattedValues[1].slice(secondIndex)) {
          content = `${data.formattedValues[0].slice(0, firstIndex)} - ${data.formattedValues[1]}`
        } else {
          content = `${data.formattedValues[0]} - ${data.formattedValues[1]}`;
        }
      } else if (data.formattedValues.length > 0) {
        content = data.formattedValues[0];
      }

      let fontSize = initialWidth / initialHeight >= 3
        ? (initialHeight * 0.8)
        : initialWidth / initialHeight >= 2
          ? (initialHeight * 0.6)
          : (initialHeight * 0.4)
          ;
      const body = `<div class="ssm-rangestat-panel-value">${ content }</div>`;
      elem.html(body);
      elem.css('font-size', `${fontSize}px`);
      do {
        fontSize = fontSize - 1;
        elem.css('font-size', `${fontSize}px`);
      } while (elem.width() > initialWidth);

      return body;
    }

    function render() {
      if (!ctrl.data) {
        return;
      }
      data = ctrl.data;

      // it seems newer Grafana has dropped support of url variables
      // $__all_variables/$__url_time_range for 3rd-party panel,
      // hence we add them by our own
      if ( typeof data.scopedVars === 'object') {
        var scopedAllVariablesStrs: string[] = [];
        for (var key in data.scopedVars) {
          if (key.indexOf('__') === 0) continue;
          scopedAllVariablesStrs.push(`var-${key}=${data.scopedVars[key].value}`);
        }
        data.scopedVars['__all_variables'] = {
          text: '__all_variables',
          value: scopedAllVariablesStrs.join('&')
        };

        if (templateSrv.timeRange) {
          data.scopedVars['__url_time_range'] = {
            text: '__url_time_range',
            value: `from=${templateSrv.timeRange.raw.from}&to=${templateSrv.timeRange.raw.to}`
          };
        }
      }

      setBigValueHtml();
      elem.toggleClass('pointer', panel.links.length > 0);

      if (panel.links.length > 0) {
        linkInfo = linkSrv.getPanelLinkAnchorInfo(panel.links[0], data.scopedVars);
      } else {
        linkInfo = null;
      }
    }

    function hookupDrilldownLinkTooltip() {
      // drilldown link tooltip
      var drilldownTooltip = $('<div id="tooltip" class="">hello</div>"');

      elem.mouseleave(function() {
        if (panel.links.length === 0) {
          return;
        }
        $timeout(function() {
          drilldownTooltip.detach();
        });
      });

      elem.click(function(evt) {
        if (!linkInfo) {
          return;
        }
        // ignore title clicks in title
        if ($(evt).parents('.panel-header').length > 0) {
          return;
        }

        if (linkInfo.target === '_blank') {
          window.open(linkInfo.href, '_blank');
          return;
        }

        if (linkInfo.href.indexOf('http') === 0) {
          window.location.href = linkInfo.href;
        } else {
          $timeout(function() {
            $location.url(linkInfo.href);
          });
        }

        drilldownTooltip.detach();
      });

      elem.mousemove(function(e) {
        if (!linkInfo) {
          return;
        }

        drilldownTooltip.text('click to go to: ' + linkInfo.title);
        drilldownTooltip.place_tt(e.pageX, e.pageY - 50);
      });
    }

    hookupDrilldownLinkTooltip();

    this.events.on('render', function() {
      render();
      ctrl.renderingCompleted();
    });
  }
}

export { SSMRangeStatCtrl, SSMRangeStatCtrl as PanelCtrl };
