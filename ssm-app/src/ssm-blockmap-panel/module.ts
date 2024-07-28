import _ from 'lodash';

import { MetricsPanelCtrl } from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';

class SSMBlockMapCtrl extends MetricsPanelCtrl {
  static templateUrl = 'ssm-blockmap-panel/module.html';
  static LINE_DIV_WIDTH = 16;
  static SERIES_NAME_DIV_HEIGHT = 24;
  static EFFECTIVE_POS_OFFSET = 6;
  static BLOCK_SIZE = 10;
  static BLOCK_GAP = 2;

  series: any[];
  unitFormats: any[];
  panel: any;
  events: any;

  // Set and populate defaults
  panelDefaults = {
    colors: ['#447EBC', '#C15C17', '#890F02', '#0A437C', '#6D1F62', '#584477', '#B7DBAB', '#F4D598', '#70DBED', '#F9BA8F', '#F29191', '#82B5D8', '#E5A8E2', '#AEA2E0', '#629E51', '#E5AC0E', '#64B0C8', '#E0752D', '#BF1B00', '#0A50A1', '#962D82', '#614D93', '#9AC48A', '#F2C96D', '#65C5DB', '#F9934E', '#EA6460', '#5195CE', '#D683CE', '#806EB7', '#3F6833', '#967302', '#2F575E', '#99440A', '#58140C', '#052B51', '#511749', '#3F2B5B', '#E0F9D7', '#FCEACA', '#CFFAFF', '#F9E2D2', '#FCE2DE', '#BADFF4', '#F9D9F9', '#DEDAF7'],
    unit: "none"
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
    this.addEditorTab('Options', 'public/plugins/ssm-blockmap-panel/editor.html', 2);
    this.unitFormats = kbn.getUnitFormats();
  }

  onDataError(err) {
    this.onDataReceived([]);
  }

  onDataReceived(dataList) {
    this.series = [];

    for (const data of dataList) {
      const lastPoint = _.last(data.datapoints);
      if (data.type === "table" || !_.isArray(lastPoint)) continue;

      const value = lastPoint[0];
      const decimalInfo = this.getDecimalsForValue(data.value);
      this.series.push({
        name: data.alias,
        value: value,
        text: kbn.valueFormats[this.panel.format](value, decimalInfo.decimals, decimalInfo.scaledDecimals)
      })
    }

    this.series.sort((s1, s2) => s1.value > s2.value ? -1 : (s1.value < s2.value ? 1 : 0));
    for (let i = 0; i < this.series.length; i++) {
      this.series[i].color = this.panel.colors[i%this.panel.colors.length];
    }

    this.render();
  }

  link(scope, elem, attrs, ctrl) {
    let panel = ctrl.panel;

    for (const key in this.panelDefaults) {
      if (key in panel) this.panel[key] = panel[key];
    }

    this.events.on('render', function() {
      const mapElem = $(elem).find('.ssm-blockmap-panel-map');
      const totalMemory = ctrl.series.reduce((a, b) => a + b.value, 0);
      const divHeight = mapElem.innerHeight();
      const divWidth = mapElem.innerWidth() - mapElem.offset().left;
      const blockRowCount = Math.floor(
                              ( divHeight - SSMBlockMapCtrl.BLOCK_SIZE )
                              / (
                                SSMBlockMapCtrl.BLOCK_SIZE + SSMBlockMapCtrl.BLOCK_GAP
                              )
                            );
      const blockColumnCount =  Math.floor(
                                  ( divWidth - SSMBlockMapCtrl.BLOCK_SIZE )
                                  / (
                                    SSMBlockMapCtrl.BLOCK_SIZE + SSMBlockMapCtrl.BLOCK_GAP
                                  )
                                );
      const blockCount = blockRowCount * blockColumnCount;
      const innerHTML = ctrl.series.map(serie => {
        return [].constructor(Math.floor(serie.value / totalMemory * blockCount)).join(
          `
            <span data-name="${serie.name}" data-color="${serie.color}" data-text="${serie.text}" class="ssm-blockmap-panel-block" style="background-color: ${serie.color}">
            </span>
          `
        );
      }).join('') + `
        <div class="tip">
        </div>
      `;
      mapElem.html(innerHTML);

      ctrl.renderingCompleted();
    });

    elem.on('mousemove', this.mouseMove);
    setInterval(()=>{
      const tipElem = $(elem).find('.ssm-blockmap-panel-map .tip').first();
      if (!tipElem || !tipElem.length) return;

      const hoveredBlock = $(elem).find('.ssm-blockmap-panel-block:hover').first();
      if (!hoveredBlock || !hoveredBlock.length) {
        tipElem.css('visibility', 'collapse');
        return;
      };
    }, 500)
  }

  setUnit(item) {
    this.panel.format = item.value;
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

  mouseMove(event) {
    const tipElem = $(event.currentTarget).find('.ssm-blockmap-panel-map .tip').first();
    if (!tipElem || !tipElem.length) return;

    const hoveredBlock = $(event.currentTarget).find('.ssm-blockmap-panel-block:hover').first();
    if (!hoveredBlock || !hoveredBlock.length) {
      tipElem.css('visibility', 'collapse');
      return;
    };

    const mapElem = $(event.currentTarget).find('.ssm-blockmap-panel-map').first();

    tipElem.html(`
      ${hoveredBlock.attr('data-name')}
      <span style="background-color: ${hoveredBlock.attr('data-color')}"></span>&nbsp;:&nbsp;
      ${hoveredBlock.attr('data-text')}
    `);
    tipElem.css('visibility', 'visible');

    var directionX: string, directionY: string, offsetX: number, offsetY: number;
    hoveredBlock.position().left > mapElem.innerWidth() / 2
      ? (
          directionX = 'right',
          offsetX = mapElem.innerWidth() - hoveredBlock.position().left
        )
      : (
          directionX = 'left',
          offsetX = hoveredBlock.position().left + SSMBlockMapCtrl.BLOCK_SIZE
        )
      ;
    hoveredBlock.position().top > mapElem.innerHeight() / 2
      ? (
          directionY = 'bottom',
          offsetY = mapElem.innerHeight() - hoveredBlock.position().top
        )
      : (
          directionY = 'top',
          offsetY = hoveredBlock.position().top + SSMBlockMapCtrl.BLOCK_SIZE
        )
      ;
    if (
      !tipElem.css(directionX)
      || Math.abs(parseInt(tipElem.css(directionX)) - offsetX) >= SSMBlockMapCtrl.EFFECTIVE_POS_OFFSET
    ) {
      tipElem.css(directionX, offsetX);
      tipElem.css(directionX === 'left' ? 'right' : 'left', '');
    }

    if (
      !tipElem.css(directionY)
      || Math.abs(parseInt(tipElem.css(directionY)) - offsetY) >= SSMBlockMapCtrl.EFFECTIVE_POS_OFFSET
    ) {
      tipElem.css(directionY, offsetY);
      tipElem.css(directionY === 'top' ? 'bottom' : 'top', '');
    }
  }
}

export { SSMBlockMapCtrl, SSMBlockMapCtrl as PanelCtrl };
