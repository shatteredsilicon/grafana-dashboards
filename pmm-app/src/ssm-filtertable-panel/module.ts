import _ from 'lodash';

import { MetricsPanelCtrl } from 'app/plugins/sdk';

class SSMFilterTableCtrl extends MetricsPanelCtrl {
  static templateUrl = 'ssm-filtertable-panel/module.html';

  table: any;
  panel: any;
  events: any;
  filterValue: string;
  sortColumn: number = -1;
  sortDesc: boolean = false;

  // Set and populate defaults
  panelDefaults = {
    filterKey: "schema",
    maxRows: 50,
    filterIgnore: "mysql,information_schema,performance_schema"
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
    this.addEditorTab('Options', 'public/plugins/ssm-filtertable-panel/editor.html', 2);
  }

  onDataError(err) {
    this.onDataReceived([]);
  }

  onDataReceived(dataList) {
    if (!dataList.length || dataList[0].type !== "table") {
      this.table = null;
    } else {
      const data = dataList[0];

      var filterKeyIndex = -1;
      var timeKeyIndex = -1;
      for (var i = 0; i < data.columns.length; i++) {
        if (data.columns[i].text === this.panel.filterKey) filterKeyIndex = i;
        if (data.columns[i].text === "Time") timeKeyIndex = i;
      }

      // sort column defaults to last column
      if (this.sortColumn === -1) this.sortColumn = data.columns.length - 1;

      let filterValueItems = !!this.filterValue ? this.filterValue.split(",").map(item => item.trim()) : [];
      let ignoreValueItems = !!this.panel.filterIgnore ? this.panel.filterIgnore.split(",").map(item => item.trim()) : [];
      if (filterKeyIndex !== -1) data.rows = data.rows.filter((row) => {
        return !(
          row.lenght <= filterKeyIndex ||
          (filterValueItems.length && filterValueItems.indexOf(row[filterKeyIndex]) === -1) ||
          (ignoreValueItems.length && ignoreValueItems.indexOf(row[filterKeyIndex]) !== -1)
        );
      });

      if (this.panel.maxRows > 0) data.rows = data.rows.slice(0, this.panel.maxRows);

      timeKeyIndex !== -1 && data.rows.map((row) => {
        const d = new Date(row[timeKeyIndex]);
        row[timeKeyIndex] = `${d.getFullYear()}-${("0" + (d.getMonth() + 1)).slice(-2)}-${("0" + d.getDate()).slice(-2)} ${("0" + d.getHours()).slice(-2)}:${("0" + d.getMinutes()).slice(-2)}:${("0" + d.getSeconds()).slice(-2)}`
      });

      this.table = data;
      this.sortData();
    }

    this.render();
  }

  toggleColumnSort(col, index) {
    if (this.sortColumn === index) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortColumn = index;
      this.sortDesc = true;
    }

    this.sortData();
  }

  sortData() {
    this.sortColumn >= 0 && this.table.rows.sort((r1, r2) => {
      if (this.sortDesc)
        return r1[this.sortColumn] < r2[this.sortColumn] ? 1 : -1;
      else
        return r1[this.sortColumn] > r2[this.sortColumn] ? 1 : -1;
    }) && this.render();
  }

  link(scope, elem, attrs, ctrl) {
    let panel = ctrl.panel;

    for (const key in this.panelDefaults) {
      if (key in panel) this.panel[key] = panel[key];
    }

    this.events.on('render', function() {
      ctrl.renderingCompleted();
    });
  }
}

export { SSMFilterTableCtrl, SSMFilterTableCtrl as PanelCtrl };
