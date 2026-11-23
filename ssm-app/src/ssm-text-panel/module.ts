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
import ssLogo from '!!url-loader!./SS-LOCKUP_BLACKBLOCK_HORIZONTAL-x150.png';
import refDoc from '!!url-loader!./reference.odt';
import luaFilter from '!!url-loader!./filter.lua';

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
  legends?: [string, string][];
  conclusion?(instance: string, current: string, proposed: string, extras: {[k: string]: any }): string;
  reports(instance: string, ts: TuningSetting, row: Element): Promise<TuningReport[]|undefined>;
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
  conclusion?: string;
}

interface Table {
  Db: string
  Table: string
}

interface Procedure {
  DB: string
  Name: string
}

interface QueryReport {
  checksum: string;
  abstract: string;
  fingerprint: string;
  tables: Table[];
  procedures: Procedure[];
  instance_ids: number[];
  db: string;
  example: string;
  explain: string;
  percentage: number;
  query_count: number;
  query_time_sum: number;
  query_time_min: number;
  query_time_avg: number;
  query_time_med: number;
  query_time_p95: number;
  query_time_max: number;
}

enum DBObjectType {
  TypeDBTable = 0,
  TypeDBProcedure,
  TypeDBView
}

interface QueryInfo {
  Type: DBObjectType
  Create: string
  Status: any
  Index: any
  Errors: Array<string>
}

interface GuessDB {
  DB: string;
  IsAmbiguous: boolean;
}

interface QueryInfoResult {
  GuessDB: GuessDB | null;
  Info: { [k: string]: QueryInfo } | null;
}

interface ExplainRow {
  Id:           number | null;
  SelectType:   string | null;
  Table:        string | null;
  Partitions:   string | null;
  CreateTable:  string | null;
  Type:         string | null;
  PossibleKeys: string | null;
  Key:          string | null;
  KeyLen:       string | null;
  Ref:          string | null;
  Rows:         number | null;
  Filtered:     number | null;
  Extra:        string | null;
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
  mysqlInstances: Instance[];

  events: any;
  $sce: any;
  $http: any;
  $scope: any;

  tuningSettings: TuningSetting[] = [
    {
      name: 'table_definition_cache',
      legends: [['Count', 'Last']],
      conclusion: tableDefCacheConclusion,
      reports: generalTuningReport
    },
    {
      name: 'table_open_cache',
      conclusion: tableOpenCacheConclusion,
      reports: generalTuningReport
    },
    {
      name: 'innodb_log_buffer_size',
      reports: generalTuningReport
    },
    {
      name: 'innodb_redo_log_capacity/innodb_log_file_size',
      conclusion: innodbLogFileSizeConclusion,
      reports: generalTuningReport
    },
    {
      name: 'innodb_io_capacity_max/innodb_io_capacity',
      legends: [['Max Disk I/O', 'Min'], ['Max Disk I/O', 'Max']],
      conclusion: innodbIOCapConclusion,
      reports: twinTuningReport
    },
    {
      name: 'innodb_read_io_threads',
      conclusion: innodbReadIOThConclusion,
      reports: generalTuningReport
    },
    {
      name: 'innodb_write_io_threads',
      conclusion: innodbWriteIOThConclusion,
      reports: generalTuningReport
    },
    {
      name: 'thread_cache_size',
      conclusion: threadCacheSizeConclusion,
      reports: generalTuningReport
    },
    {
      name: 'innodb_buffer_pool_size',
      legends: [['Index Size', 'Last'], ['RAM', 'Last']],
      conclusion: innodbBufPoolSizeConclusion,
      reports: generalTuningReport
    },
    {
      name: 'key_buffer_size',
      legends: [['Index Size', 'Last']],
      conclusion: keyBufSizeConclusion,
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
    this.$http = $http;
    this.$scope = $scope;
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataReceived.bind(this));
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
      (window as any).downloadReport = async ({ delay = 5000, from = 'now-7d', to = 'now', load = 0.01 } = {}) => {
        this.downloadReport(undefined, this.instances?.[0], delay, from, to, load);
      }
      (window as any).downloadReportAll = async ({ delay = 5000, from = 'now-7d', to = 'now', load = 0.01 } = {}) => {
        this.downloadReportAll(delay, from, to, load);
      };

      this.getInstances($http, templateSrv.getVariables().find(v => v.name === 'host')?.current.value);
    }
  }

  async downloadReport(originZip, instance: Instance, delay, from, to, load) {
    if (instance === undefined) {
      console.log('instance data is missing or not loaded yet');
      return;
    }

    console.log(`generating the report for ${instance.Name}...`);

    const queryParams = this.$scope.ctrl.$location.search();
    queryParams.from = from;
    queryParams.to = to;
    this.$scope.ctrl.$location.search(queryParams);

    // scroll 1/3 at a time so the content gets rendered properly
    window.scrollTo({
      top: document.documentElement.scrollHeight/3,
      behavior: 'smooth',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    window.scrollTo({
      top: 2*(document.documentElement.scrollHeight/3),
      behavior: 'smooth',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });

    const filename = `${instance.Name}.zip`;
    let zip: any;
    if (originZip === undefined) {
      zip = new ZipWriter(new BlobWriter('application/zip'));
    } else {
      zip = originZip;
    }

    const tuningPromise = this.tuningReports(instance.Name, zip, delay);
    const queryPromise = this.queryReports(
      [instance],
      {
        from: moment.isMoment(from) ? moment(from) : dateMath.parse(from),
        to: moment.isMoment(to) ? moment(to) : dateMath.parse(to),
      },
      load
    );
    const summaryPromise = this.summaryReport(instance);

    let [tReports, qReports, tkSummary] = await Promise.all([tuningPromise, queryPromise, summaryPromise]);
    qReports = qReports.filter((r)=>!(r.tables?.findIndex((t) => ['mysql', 'information_schema', 'performance_schema'].includes(t.Db)) >= 0));
    qReports.forEach(r=>{
      if (r.db !== undefined && r.tables?.length > 0 ) {
        r.tables.forEach(t => {
          if (t.Db === undefined || t.Db === '') t.Db = r.db;
        })
      }
    })

    try {
      tkSummary = this.trimTKSummary(tkSummary);
    } catch(e) {
      console.log(`failed to trim toolkit summary for ${instance.Name}: `, e);
    }

    const queryMap: { [key: string]: any } = {};
    for (const r of qReports) {
      let db = r.db;

      if (r.tables?.length > 0 || r.procedures?.length > 0) {
        const queryInfo = await this.getQueryInfo(instance, r.tables || [], r.procedures || []);
        const tables = r.tables?.filter(t => queryInfo?.Info?.[`${t.Db || queryInfo.GuessDB?.DB}.${t.Table}`] && queryInfo.Info[`${t.Db || queryInfo.GuessDB?.DB}.${t.Table}`].Type === DBObjectType.TypeDBTable);
        const views = r.tables?.filter(t => queryInfo?.Info?.[`${t.Db || queryInfo.GuessDB?.DB}.${t.Table}`] && queryInfo.Info[`${t.Db || queryInfo.GuessDB?.DB}.${t.Table}`].Type === DBObjectType.TypeDBView);
        const procedures = r.procedures || [];
        queryMap[r.checksum] = {
          'Tables': tables?.map(t => {
            const db = t.Db || queryInfo?.GuessDB?.DB
            return {
              'Db': db,
              'Table': t.Table,
              'Create': queryInfo?.Info?.[`${db}.${t.Table}`]?.Create,
              'Index': queryInfo?.Info?.[`${db}.${t.Table}`]?.Index
            };
          }),
          'Views': views?.map(v => {
            const db = v.Db || queryInfo?.GuessDB?.DB
            return {
              'Db': db,
              'Name': v.Table,
              'Create': queryInfo?.Info?.[`${db}.${v.Table}`]?.Create,
              'Index': queryInfo?.Info?.[`${db}.${v.Table}`]?.Index
            };
          }),
          'Prodecures': procedures?.map(p => {
            const db = p.DB || queryInfo?.GuessDB?.DB;
            return {
              'Db': db,
              'Name': p.Name,
              'Create': queryInfo?.Info?.[`${db}.${p.Name}`]?.Create,
              'Index': queryInfo?.Info?.[`${db}.${p.Name}`]?.Index
            }
          })
        }

        if ((r.db === undefined || r.db=== '') && queryInfo?.GuessDB?.DB !== undefined) {
          db = queryInfo?.GuessDB?.DB;
        }
      }

      if (!r.example) continue;

      const explain = await this.getExplain(instance, db, r.example, r.explain);
      if (!(r.checksum in queryMap)) { queryMap[r.checksum] = {} }
      queryMap[r.checksum] = {
        ...queryMap[r.checksum],
        'Query': r.example,
        'Explain': explain
      };
    }

    zip.add(`${instance.Name}/ss-logo.png`, new BlobReader(this.base64ToBlob(ssLogo, 'image/png')));
    zip.add(`${instance.Name}/reference.odt`, new BlobReader(this.base64ToBlob(refDoc, 'application/vnd.oasis.opendocument.text')));
    zip.add(`${instance.Name}/filter.lua`, new BlobReader(this.base64ToBlob(luaFilter, 'text/plain')));

    Object.keys(queryMap).forEach(k=>{
      zip.add(`${instance.Name}/${k}.json`, new TextReader(JSON.stringify(queryMap[k], undefined, 2)));
    })

    try {
      zip.add(
        `${instance.Name}/report.md`,
        new TextReader(
          Mustache.render(
            reportMD,
            {
              'instance': instance.Name,
              'tuning_reports': tReports.map((t, i)=>{ return {...t, delimiter: i % 2 == 1 || i === tReports.length-1 ? '\n\n\\newpage' : '\\'} }),
              'query_reports': qReports,
              'toolkit_summary': tkSummary,
              'abstract_func': function () {
                return escape(this.abstract);
              },
              'example_func': function () {
                return beautify.sql(this.example || this.fingerprint);
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
    } catch(e) {
      console.log(`failed to render/add md file to the zip file for '${instance.Name}': `, e);
    }

    if (originZip === undefined) {
      zip.close()
        .then(function (content: Blob) {
          // see FileSaver.js
          saveAs(content, filename);
        });
    }
  };

  async downloadReportAll(delay, from, to, load) {
    if (!this.mysqlInstances?.length) return;

    const zip = new ZipWriter(new BlobWriter('application/zip'));
    for (const instance of this.mysqlInstances) {
      try {
        const queryParams = this.$scope.ctrl.$location.search();
        queryParams['var-host'] = instance.Name;
        this.$scope.ctrl.$location.search(queryParams);

        await this.downloadReport(zip, instance, delay, from, to, load);
      } catch(e) {
        console.log(`failed to generate report for '${instance.Name}': `, e);
      }
    }

    zip.close()
        .then(function (content: Blob) {
          // see FileSaver.js
          saveAs(content, 'ssm-report.zip');
        });
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

        this.mysqlInstances = (response.data as Instance[]).filter(i => i.Subsystem === 'mysql').map(i=>{ return { ...i, Agent: agentsByParentUUID[i.ParentUUID] } });

        const hosts = host?.split(',');
        this.instances = (response.data.filter(
          (i: Instance) => hosts?.indexOf(i.Name) !== -1 && (i.Subsystem === 'mysql' || i.Subsystem === 'mongo' || i.Subsystem === 'postgresql')
        ) as Instance[]).map((i)=>{return {...i, Agent: agentsByParentUUID[i.ParentUUID]}});
      });
  }

  async tuningReports(instance: string, zip: any, delay?: number): Promise<TuningReport[]> {
    return new Promise(resolver => setTimeout(async ()=>{
      const reports: TuningReport[] = [];
      const elems = document.body.querySelectorAll<HTMLElement>('span[role="heading"]');
      for (let i = 0; i < elems.length; i++) {
        const elem = elems.item(i);

        const settings = this.tuningSettings.find(ts => ts.name === elem.innerText);
        if (!settings) continue;

        const rs = await settings.reports(instance, settings, elem);
        rs?.forEach(report => {
          const binaryString = atob(report.image.dataURL.split(';base64,')[1]);
  
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          zip.add(`${instance}/${report.image.filename}`, new BlobReader(new Blob([bytes])));
          reports.push(report);
          reports.map(()=>'').join('|')
        })
      }

      resolver(reports);
    }, delay ?? 5000));
  }

  async queryReports(instances: Instance[], timeRange: any, load: number): Promise<QueryReport[]> {
    return fetch(`/qan-api/qan/summary-queries?begin=${timeRange.from.toISOString().replace(/Z$/, '')}&end=${timeRange.to.toISOString().replace(/Z$/, '')}&load=${load}&${instances?.map(instance => `uuids[]=${instance.UUID}`).join('&')}`, {
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
        if (res === undefined || res?.['Error']) {
          console.log(`WARNING: failed to download summary report for '${instance.Name}': `, res?.['Error']);
          return '';
        }
        return atob((res?.['Data'] ?? '') as string).replace(/\\n/g, '\n').replace(/\\t/g, '\t').slice(1, -1);
      })
      .catch(e => {
        console.log(`WARNING: failed to downlod summary report for '${instance.Name}': `, e);
        return '';
      });
  }

  private base64ToBlob(base64DataUrl: string, contentType: string): Blob {
    const base64Str = base64DataUrl.split(',')[1]; 
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
  }

  async getQueryInfo(instance: Instance, tables: Table[], procedures: Procedure[]) {
    const url = `/qan-api/agents/${instance.Agent?.UUID}/cmd`;

    const data = {
      UUID: instance.UUID,
      Table: tables,
      Index: tables,
      Status: tables,
      Procedure: procedures,
    };

    const params = {
      AgentUUID: instance.Agent?.UUID,
      Service: 'query',
      Cmd: 'QueryInfo',
      Data: btoa(JSON.stringify(data))
    };

    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
      .then(res => res.json())
      .then(res => {
        if (res === undefined || res?.['Error']) {
          console.log(`WARNING: failed to get query info for '${instance.Name}': `, res?.['Error']);
          return;
        }
        return JSON.parse(atob(res?.['Data'])) as QueryInfoResult;
      })
      .catch(e => {
        console.log(`WARNING: failed to get query info for '${instance.Name}': `, e);
        return;
      });
  }

  async getExplain(instance: Instance, dbName: string, query: string, withExplain: string) {
    const url = `/qan-api/agents/${instance.Agent?.UUID}/cmd`;
    const data = {
      UUID: instance.UUID,
      Db: dbName,
      Query: query,
      Convert: true,  // agent will convert if not SELECT and MySQL <= 5.5 or >= 5.6 but no privs
      WithExplainRows: withExplain ? JSON.parse(withExplain) as ExplainRow[] : []
    };

    const params = {
      AgentUUID: instance.Agent?.UUID,
      Service: 'query',
      Cmd: 'Explain',
      Data: btoa(JSON.stringify(data))
    };

    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
      .then(res => res.json())
      .then(res => {
        if (res === undefined || res?.['Error']) {
          return res?.['Error'];
        }
        return JSON.parse(atob(res?.['Data']))?.['Classic'];
      })
      .catch(e => {
        console.log(`WARNING: failed to get explain for '${instance.Name}': `, e);
        return;
      });
  }

  trimTKSummary(summary: string): string {
    const lines: string[] = summary.split(/\r?\n/);

    const trimPos = [];
    for (let i = 0; i < lines.length;) {
      if (!(/^\# \#+$/.test(lines[i]) && i+1<lines.length && /^\# .+$/.test(lines[i+1]) && i+2<lines.length && /^\# \#+$/.test(lines[i+2]))) {
        i++;
        continue
      }

      let j = i+3, trimStart, trimEnd, shouldBeTrimed = true;
      for (; j < lines.length; j++) {
        if (/^#   KEY .+ \/\*!80000 INVISIBLE \*\//.test(lines[j]) || /^#   KEY .+ IGNORED/.test(lines[j])) {
          shouldBeTrimed = false;
        }

        if (/^#/.test(lines[j]) && trimStart === undefined) {
          trimStart = j;
          continue
        }

        if (trimStart !== undefined && !(/^#/.test(lines[j])) && lines[j].trim().length > 0) {
          trimEnd = j;
          break
        }
      }

      if (shouldBeTrimed && trimStart !== undefined && trimEnd !== undefined) {
        trimPos.push([trimStart, trimEnd])
      }

      i = j+1;
    }

    trimPos.toReversed().forEach(([start, end]) => {
      lines.splice(start, end-start);
    })
    
    return lines.join('\r\n');
  }

  onDataReceived() {
    var templateSrv = this.templateSrv;

    this.getInstances(this.$http, templateSrv.getVariables().find(v => v.name === 'host')?.current.value);
    this.render();
  }
}

const generalTuningReport = async (instance: string, ts: TuningSetting, row: HTMLElement): Promise<TuningReport[]|undefined> => {
  const rowPanel = row.closest<HTMLElement>('div[id]');
  const graph = rowPanel?.nextElementSibling as HTMLElement;
  const current = graph?.nextElementSibling as HTMLElement;
  const proposed = current?.nextElementSibling as HTMLElement;

  if (!graph || !current || !proposed) return undefined;

  const extras: {[k: string]: any} = {};
  ts.legends && ts.legends.forEach(([k, v])=>{
    const legendTable = graph?.querySelector<HTMLElement>('[class$="-LegendRow"]')?.closest('table');
    const legendIdx = Array.from(legendTable?.querySelectorAll<HTMLTableCellElement>('tbody tr td:nth-child(1)') ?? []).findIndex(th=>th.innerText.trim()===k);
    const fieldIdx = Array.from(legendTable?.querySelectorAll<HTMLTableCellElement>('thead tr th') ?? []).findIndex(th=>th.innerText.trim()===v);
    const legendValue = legendTable?.querySelector<HTMLTableCellElement>(`tbody tr:nth-child(${legendIdx+1}) td:nth-child(${fieldIdx+1})`)?.innerText;
    extras[`${k} ${v}`] = legendValue;
  });

  const graphDataURL = await html2image(graph.firstChild as HTMLElement);

  const fixedName = ts.name.replaceAll('/', '_or_');
  const currentVal = (current.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  const proposedVal = (proposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  return [{
    title: ts.name,
    image: {
      filename: `${fixedName}.png`,
      dataURL: graphDataURL,
    },
    current: currentVal,
    proposed: proposedVal,
    conclusion: ts.conclusion?.(instance, currentVal, proposedVal, extras)
  }]
}

const twinTuningReport = async (instance: string, ts: TuningSetting, row: HTMLElement): Promise<TuningReport[]|undefined> => {
  const rowPanel = row.closest<HTMLElement>('div[id]');
  const graph = rowPanel?.nextElementSibling as HTMLElement;
  const firstCurrent = graph?.nextElementSibling as HTMLElement;
  const firstProposed = firstCurrent?.nextElementSibling as HTMLElement;
  const secondCurrent = firstProposed?.nextElementSibling as HTMLElement;
  const secondProposed = secondCurrent?.nextElementSibling as HTMLElement;

  if (!graph || !firstCurrent || !firstProposed || !secondCurrent || !secondProposed) return undefined;

  const extras: {[k: string]: any} = {};
  ts.legends && ts.legends.forEach(([k, v])=>{
    const legendTable = graph?.querySelector<HTMLElement>('[class$="-LegendRow"]')?.closest('table');
    const legendIdx = Array.from(legendTable?.querySelectorAll<HTMLTableCellElement>('thead tr th') ?? []).findIndex(th=>th.innerText.trim()===v);
    const legendValue = legendTable?.querySelector<HTMLTableCellElement>(`tbody td:nth-child(${legendIdx})`)?.innerText;
    extras[`${k} ${v}`] = legendValue;
  });

  const graphDataURL = await html2image(graph.firstChild as HTMLElement);

  const [firstName, secondName] = ts.name.split('/');
  const firstCurrentVal = (firstCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  const firstProposedVal = (firstProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  const secondCurrentVal = (secondCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  const secondProposedVal = (secondProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '').trim();
  return [{
    title: firstName,
    image: {
      filename: `${firstName}.png`,
      dataURL: graphDataURL,
    },
    current: firstCurrentVal,
    proposed: firstProposedVal,
    conclusion: ts.conclusion?.(instance, firstCurrentVal, firstProposedVal, {...extras, 'Name': firstName})
  }, {
    title: secondName,
    image: {
      filename: `${secondName}.png`,
      dataURL: graphDataURL,
    },
    current: secondCurrentVal,
    proposed: secondProposedVal,
    conclusion: ts.conclusion?.(instance, secondCurrentVal, secondProposedVal, {...extras, 'Name': secondName})
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

function parseSize(input: string): number {
  const unitMultipliers: {[k: string]: number} = {
    b: 1,
    kb: 1e3,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
    pb: 1e15,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5,
  };

  const match = input.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-z]+)?$/i);
  if (!match) {
    return Number(input);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier = unitMultipliers[unit];

  if (multiplier === undefined) {
    return Number(input);
  }

  return Math.round(value * multiplier);
}

const tableDefCacheConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) >= Number(proposed)) return '';
  return `There are ${extras['Count Last']} tables in ${instance}. As a first pass estimate, \`table_definition_cache\` should be set a little larger than the number of tables in the database (higher in order to also be able to accommodate temporary tables). Proposed value to set \`table_definition_cache\` to is ${proposed}.`
}

const tableOpenCacheConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) === Number(proposed)) return '';
  return `\`table_open_cache\` is too ${Number(current) < Number(proposed) ? 'close' : 'far'} from the configured maximum, which suggests it is ${Number(current) < Number(proposed) ? 'underspecified' : 'overspecified'}. The proposed value to set it to is ${proposed}.`
}

const innodbLogFileSizeConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  const currentVal = parseSize(current);
  const proposedVal = parseSize(proposed);
  if (isNaN(currentVal) || isNaN(proposedVal) || currentVal === proposedVal) return '';
  return `Redo log fill is ${currentVal < proposedVal ? 'reaching too high' : 'not getting near the redo log size'}. This suggests that the redo log is ${currentVal < proposedVal ? 'underspecified' : 'overspecified'}. Proposed value to set it to is ${proposed}`
}

const innodbIOCapConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) === Number(proposed)) return '';

  if (extras['Name'] === 'innodb_io_capacity_max') {
    return `Extrapolated peak disk I/O capacity is significantly ${Number(current) < Number(proposed) ? 'higher' : 'lower'} than the configured I/O capacity estimate. It looks like the storage subsystem can manage between ${extras['Max Disk I/O Min']} and ${extras['Max Disk I/O Max']} iops. The proposed value innodb_io_capacity_max is ${proposed}.`
  } else if (extras['Name'] === 'innodb_io_capacity') {
    return `The current value configured for innodb_io_capacity looks like too ${Number(current) < Number(proposed) ? 'low' : 'high'} a fraction of peak disk I/O capacity extrapolated. For most workloads between half and two thirds of the extrapolated peak disk I/O capacity is optimal, which in this case is a proposed value of ${proposed} iops.`
  }

  return '';
}

const innodbReadIOThConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) === Number(proposed)) return '';
  if (Number(current) < Number(proposed)) {
    return `The server workload results in queued reads some of the time, which suggests that there are too few read I/O threads configured. The proposed adjustment is to double innodb_read_io_threads to ${proposed}.`
  } else if (Number(current) > Number(proposed)) {
    return `The server workload doesn't result in queued reads at all, which suggests that there may be unnecessarily many read I/O threads configured. The proposed adjustment is to halve innodb_read_io_threads to ${proposed}.`;
  }
  return '';
}

const innodbWriteIOThConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) === Number(proposed)) return '';
  if (Number(current) < Number(proposed)) {
    return `The server workload results in queued writes some of the time, which suggests that there are too few write I/O threads configured. The proposed adjustment is to double innodb_write_io_threads to ${proposed}.`
  } else if (Number(current) > Number(proposed)) {
    return `The server workload doesn't result in queued writes at all, which suggests that there may be unnecessarily many write I/O threads configured. The proposed adjustment is to halve innodb_write_io_threads to ${proposed}.`;
  }
  return '';
}

const threadCacheSizeConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  if (isNaN(Number(current)) || isNaN(Number(proposed)) || Number(current) === Number(proposed)) return '';
  return `Thread cache looks ${Number(current) < Number(proposed) ? 'underspecified' : 'overspecified'}, the gap between minimum and maximum threads per time bucket is a significantly ${Number(current) < Number(proposed) ? 'higher' : 'lower'} than the configured thread_cache_size. Recommend adjusting it to ${proposed}.`
}

const innodbBufPoolSizeConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  const indexSize = parseSize(extras['Index Size Last']);
  const ramSize = parseSize(extras['RAM Last']);
  const currentVal = parseSize(current);
  const proposedVal = parseSize(proposed);

  if (isNaN(currentVal) || isNaN(proposedVal) || isNaN(indexSize) || isNaN(ramSize)) return '';

  if (indexSize <= currentVal && currentVal <= (indexSize * 1.2)) {
    return 'Buffer pool size looks reasonably optimal for the data set.';
  } else if (currentVal > (ramSize * 0.8)) {
    return `Buffer pool size looks too large for the server memory size, which can result in out-of-memory errors.`;
  } else if (indexSize > currentVal) {
    return `Buffer pool looks underspecified for the data set.`;
  }
  return '';
}

const keyBufSizeConclusion = (instance: string, current: string, proposed: string, extras: {[k: string]: any}): string => {
  const indexSize = parseSize(extras['Index Size Last']);
  const currentVal = parseSize(current);
  const proposedVal = parseSize(proposed);

  if (isNaN(currentVal) || isNaN(proposedVal) || isNaN(indexSize)) return '';

  if (indexSize === 0) {
    return 'There are no non-system MyISAM tables, so this can be safely reduced to 1 MiB.';
  } else {
    return 'key_buffer_size should be sized to accommodate all MyISAM indexes. Propose setting this to [proposed]. It is worth noting that use of MyISAM is sub-optimal for most workloads, so it is worth verifying if there is an overwhelming reason for using it on this system.';
  }
}

export { SSMTextPanelCtrl, SSMTextPanelCtrl as PanelCtrl };
