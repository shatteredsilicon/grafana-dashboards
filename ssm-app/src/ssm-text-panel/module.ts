/// <reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import * as dateMath from 'app/core/utils/datemath';
import { Remarkable } from 'remarkable';
import { toPng } from 'html-to-image';
import { ZipWriter, BlobReader, TextReader, BlobWriter } from '@zip.js/zip.js';
import { saveAs } from 'file-saver-es';
import Mustache from 'mustache';
import beautify from 'beautify';
import escape from 'markdown-escape';
import moment from 'moment';

import reportMD from './report.md';

interface Instance {
  Created: string;
  DSN: string;
  Deleted: string;
  Distro: string;
  Id: number;
  Name: string;
  ParentUUID: string;
  Subsystem: string;
  UUID: string;
  Version: string;
  Agent?: Instance | null;
};

interface TuningSetting {
  name: string;
  reports(name: string, row: Element): Promise<TuningReport[]|undefined>;
}

interface TuningReportImage {
  filename: string;
  dataURL: string;
}

interface TuningReport {
  title: string;
  image: TuningReportImage;
  current: string;
  proposed: string;
}

interface QueryReport {
  checksum: string;
  abstract: string;
  fingerprint: string;
  instance_ids: number[];
  example: string;
  percentage: number;
  query_count: number;
  query_time_sum: number;
  query_time_min: number;
  query_time_avg: number;
  query_time_med: number;
  query_time_p95: number;
  query_time_max: number;
}

class SSMTextPanelCtrl extends MetricsPanelCtrl {
  static templateUrl = `module.html`;
  static scrollable = true;

  static API = {
    INSTANCES: '/qan-api/instances?deleted=no',
    SUMMARY_QUERIES: '/qan-api/qan/summary-queries',
  };

  remarkable: any;
  content: string;
  // Set and populate defaults
  panelDefaults = {
    mode: 'markdown', // 'html', 'markdown', 'text'
    content: '# title',
    report: false
  };

  instances: Instance[];

  events: any;
  $sce: any;

  tuningSettings: TuningSetting[] = [
    {
      name: 'table_definition_cache',
      reports: generalTuningReport
    },
    {
      name: 'table_open_cache',
      reports: generalTuningReport
    },
    {
      name: 'innodb_log_buffer_size',
      reports: generalTuningReport
    },
    {
      name: 'innodb_redo_log_capacity/innodb_log_file_size',
      reports: generalTuningReport
    },
    {
      name: 'innodb_io_capacity_max/innodb_io_capacity',
      reports: twinTuningReport
    },
    {
      name: 'innodb_read_io_threads',
      reports: generalTuningReport
    },
    {
      name: 'innodb_write_io_threads',
      reports: generalTuningReport
    },
    {
      name: 'thread_cache_size',
      reports: generalTuningReport
    },
    {
      name: 'innodb_buffer_pool_size',
      reports: generalTuningReport
    },
    {
      name: 'key_buffer_size',
      reports: generalTuningReport
    },
    {
      name: 'aria_pagecache_buffer_size',
      reports: generalTuningReport
    },
    {
      name: 'binlog_cache_size',
      reports: generalTuningReport
    },
    {
      name: 'binlog_stmt_cache_size',
      reports: generalTuningReport
    },
    {
      name: 'tmp_table_size',
      reports: generalTuningReport
    },
    {
      name: 'innodb_adaptive_hash_index',
      reports: generalTuningReport
    }
  ];

  /** @ngInject **/
  constructor($scope, $injector, templateSrv, $sce, $http) {
    super($scope, $injector);
    this.$sce = $sce;
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('render', this.onRender.bind(this));

    $scope.$watch(
      'ctrl.panel.content',
      _.throttle(() => {
        this.render();
      }, 1000)
    );

    Mustache.escape = function(text) { return text; }
    if (this.panel.report) {
      (window as any).downloadReport = async ({ delay = 5000, from = 'now-7d', to = 'now', load = 0.01 }={}) => {
        if (!this.instances?.length) {
          console.log('instance data is missing or not loaded yet');
          return;
        }

        console.log('generating the report...');

        const queryParams = $scope.ctrl.$location.search();
        queryParams.from = from;
        queryParams.to = to;
        $scope.ctrl.$location.search(queryParams);

        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        });

        const date = (new Date()).toISOString().split('.')[0];
        const filename = `ssm-report-${date}.zip`;
        const zip = new ZipWriter(new BlobWriter('application/zip'));

        const tuningPromise = this.tuningReports(zip, delay);
        const queryPromise = this.queryReports({
          from: moment.isMoment(from) ? moment(from) : dateMath.parse(from),
          to: moment.isMoment(to) ? moment(to) : dateMath.parse(to),
        }, load);
        const summaryPromise = this.summaryReport(this.instances?.[0]);

        const [tReports, qReports, tkSummary] = await Promise.all([tuningPromise, queryPromise, summaryPromise]);

        zip.add(
          'report.md',
          new TextReader(
            Mustache.render(
              reportMD,
              {
                'tuning_reports': tReports,
                'query_reports': qReports,
                'toolkit_summary': tkSummary,
                'abstract_func': function () {
                  return escape(this.abstract);
                },
                'example_func': function () {
                  return beautify.sql(this.example);
                },
                'percentage_func': function () {
                  return humanize(this.percentage, 'percent');
                },
                'query_time_avg_func': function () {
                  return humanize(this.query_time_avg, 'time');
                },
                'query_count_func': function () {
                  return humanize(this.query_count, 'number');
                }
              }
            )
          )
        );
        zip.close()
          .then(function (content: Blob) {
            // see FileSaver.js
            saveAs(content, filename);
          });
      };

      this.getInstances($http, templateSrv.getVariables().find(v => v.name === 'host')?.current.value);
    }
  }

  onInitEditMode() {
    this.addEditorTab('Options', './editor.html', 2);
    this.editorTabIndex = 1;

    if (this.panel.mode === 'text') {
      this.panel.mode = 'markdown';
    }
  }

  onRefresh() {
    this.render();
  }

  onRender() {
    if (this.panel.mode === 'markdown') {
      this.renderMarkdown(this.panel.content);
    } else if (this.panel.mode === 'text') {
      this.renderText(this.panel.content);
    } else if (this.panel.mode === 'html') {
      this.updateContent(this.panel.content);
    }
    this.renderingCompleted();
  }

  renderText(content) {
    content = content
      .replace(/&/g, '&amp;')
      .replace(/>/g, '&gt;')
      .replace(/</g, '&lt;')
      .replace(/\n/g, '<br/>');
    this.updateContent(content);
  }

  renderMarkdown(content) {
    if (!this.remarkable) {
      this.remarkable = new Remarkable();
    }

    this.$scope.$applyAsync(() => {
      this.updateContent(this.remarkable.render(content));
    });
  }

  updateContent(html) {
    try {
      this.content = this.$sce.trustAsHtml(this.templateSrv.replace(html, this.panel.scopedVars));
    } catch (e) {
      console.log('Text panel error: ', e);
      this.content = this.$sce.trustAsHtml(html);
    }
  }

  private getInstances($http, host?: string): void {
    $http({
      method: 'GET',
      url: SSMTextPanelCtrl.API.INSTANCES,
    })
      .then((response: any) => {
        const agentsByParentUUID: { [key: string]: Instance } = {};
        response.data.forEach(
          (i: Instance) => {
            if (i.Subsystem === 'agent') agentsByParentUUID[i.ParentUUID] = i;
          }
        );

        const hosts = host?.split(',');
        this.instances = (response.data.filter(
          (i: Instance) => hosts.indexOf(i.Name) !== -1 && (i.Subsystem === 'mysql' || i.Subsystem === 'mongo' || i.Subsystem === 'postgresql')
        ) as Instance[]).map((i)=>{return {...i, Agent: agentsByParentUUID[i.ParentUUID]}});
      });
  }

  async tuningReports(zip: any, delay?: number): Promise<TuningReport[]> {
    return new Promise(resolver => setTimeout(async ()=>{
      const reports: TuningReport[] = [];
      const elems = document.body.querySelectorAll<HTMLElement>('span[role="heading"]');
      for (let i = 0; i < elems.length; i++) {
        const elem = elems.item(i);

        const settings = this.tuningSettings.find(ts => ts.name === elem.innerText);
        if (!settings) continue;

        const rs = await settings.reports(settings.name, elem);
        rs?.forEach(report => {
          const binaryString = atob(report.image.dataURL.split(';base64,')[1]);
  
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          zip.add(report.image.filename, new BlobReader(new Blob([bytes])));
          reports.push(report);
          reports.map(()=>'').join('|')
        })
      }

      resolver(reports);
    }, delay ?? 5000));
  }

  async queryReports(timeRange: any, load: number): Promise<QueryReport[]> {
    return fetch(`/qan-api/qan/summary-queries?begin=${timeRange.from.toISOString().replace(/Z$/, '')}&end=${timeRange.to.toISOString().replace(/Z$/, '')}&load=${load}&${this.instances?.map(instance => `uuids[]=${instance.UUID}`).join('&')}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then<QueryReport[]>(res => res.json())
  }

  async summaryReport(instance: Instance): Promise<string> {
    return fetch(`/qan-api/agents/${instance.Agent?.UUID}/cmd`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AgentUUID: instance.Agent?.UUID,
        Service: 'query',
        Cmd: 'ToolkitSummary',
        Data: btoa(JSON.stringify({ UUID: instance.UUID }))
      })
    })
      .then<{ [key: string]: any }>(res => res.json())
      .then<string>(res => {
        if (res?.['Error']) {
          console.log('WARNING: failed to download summary report: ', res?.['Error']);
          return '';
        }
        return atob((res?.['Data'] ?? '') as string).replace(/\\n/g, '\n').replace(/\\t/g, '\t').slice(1, -1);
      })
      .catch(e => {
        console.log('WARNING: failed to downlod summary report: ', e);
        return '';
      });
  }
}

const generalTuningReport = async (name: string, row: HTMLElement): Promise<TuningReport[]|undefined> => {
  const rowPanel = row.closest<HTMLElement>('div[id]');
  const graph = rowPanel?.nextElementSibling as HTMLElement;
  const current = graph?.nextElementSibling as HTMLElement;
  const proposed = current?.nextElementSibling as HTMLElement;

  if (!graph || !current || !proposed) return undefined;

  const graphDataURL = await html2image(graph.firstChild as HTMLElement);

  const fixedName = name.replaceAll('/', '_or_');
  return [{
    title: name,
    image: {
      filename: `${fixedName}.png`,
      dataURL: graphDataURL,
    },
    current: current.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '',
    proposed: proposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? ''
  }]
}

const twinTuningReport = async (name: string, row: HTMLElement): Promise<TuningReport[]|undefined> => {
  const rowPanel = row.closest<HTMLElement>('div[id]');
  const graph = rowPanel?.nextElementSibling as HTMLElement;
  const firstCurrent = graph?.nextElementSibling as HTMLElement;
  const firstProposed = firstCurrent?.nextElementSibling as HTMLElement;
  const secondCurrent = firstProposed?.nextElementSibling as HTMLElement;
  const secondProposed = secondCurrent?.nextElementSibling as HTMLElement;

  if (!graph || !firstCurrent || !firstProposed || !secondCurrent || !secondProposed) return undefined;

  const graphDataURL = await html2image(graph.firstChild as HTMLElement);

  const [firstName, secondName] = name.split('/');
  return [{
    title: firstName,
    image: {
      filename: `${firstName}.png`,
      dataURL: graphDataURL,
    },
    current: firstCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '',
    proposed: firstProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? ''
  }, {
    title: secondName,
    image: {
      filename: `${secondName}.png`,
      dataURL: graphDataURL,
    },
    current: secondCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '',
    proposed: secondProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? ''
  }]
}

const html2image = async (elem: HTMLElement): Promise<string> => {
  const userAgent = window.navigator.userAgent;
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    // the html-to-image package has a compatibility issue with Safari,
    // we have to call it twice to get the fully rendered data
    await toPng(elem, {backgroundColor: 'rgba(0, 0, 0, 0)', skipFonts: true});
  }

  return toPng(elem, {backgroundColor: 'rgba(0, 0, 0, 0)', skipFonts: true});
}

function formatBytes(bytes: number) {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'];
  
  // Use 1024 for IEC units (KiB, MiB, etc.)
  const base = 1024; 
  const i = Math.floor(Math.log(bytes) / Math.log(base));
  
  // Prevent index from going out of bounds
  const unitIndex = Math.max(0, Math.min(i, units.length - 1)); 

  const value = bytes / Math.pow(base, unitIndex);
  
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: units[unitIndex],
    unitDisplay: 'short', // or 'narrow', 'long'
    maximumFractionDigits: 2, // Adjust as needed
  });

  return formatter.format(value);
}

function parceTime(input: number) {
  let dur = '';
  const dur_sec = moment.duration(input, 's');
  switch (true) {
    case input === 0:
      dur = '0';
      break;
    case dur_sec.as('s') > 1 && dur_sec.as('s') < 60:
      dur = dur_sec.as('s').toFixed(2) + ' sec';
      break;
    case dur_sec.as('s') >= 60:
      let secs = dur_sec.as('s');
      const secondsInDay = 24 * 60 * 60;
      if (secs >= secondsInDay) {
        const days = Math.floor(secs / secondsInDay);
        dur = `${days} days, `;
        secs = secs % secondsInDay;
      }
      dur += Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(secs);
      break;
    case dur_sec.as('ms') < 1:
      dur = (dur_sec.as('ms') * 1000).toFixed(2) + ' \µs';
      break;
    default:
      dur = dur_sec.as('ms').toFixed(2) + ' ms';
      break;
  }
  return dur;
}

function humanize(input: number, name: string): string {
  if (input === null) {
    return '0';
  }

  let res = '0';
  switch (true) {
    // "top 10"/profile queries no name parameters
    case name === undefined:
      res = parceTime(input);
      break;
    // time
    case name.indexOf('time') > -1:
      res = (input !== 0 && input < 0.00001) ? '<' : '';
      res += parceTime(input);
      break;
    // size
    case name.indexOf('size') > -1:
      if (input !== 0 && input < 0.01) {
        res = '<0.01 B';
      } else {
        res = formatBytes(input);
      }
      res = res.replace(/([\d]) B/, '$1 Bytes');
      break;
    // ops
    case name.indexOf('number') > -1:
      if (input !== 0 && input < 0.01) {
        res = '<0.01';
      } else {
        res = new Intl.NumberFormat(undefined, {notation: 'compact'}).format(input);
      }
      break;
    case name.indexOf('percent') > -1:
      if (input !== 0 && input < 0.0001) {
        res = '<0.01';
      } else {
        res = new Intl.NumberFormat(undefined, {style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2}).format(input);
      }
      break;
    // ops
    default:
      if (input !== 0 && input < 0.01) {
        res = '<0.01';
      } else {
        res = new Intl.NumberFormat(undefined, {notation: 'compact'}).format(input);
      }
      break;
  }
  return String(res).replace('<0.00', '<0.01');
}

export { SSMTextPanelCtrl, SSMTextPanelCtrl as PanelCtrl };
