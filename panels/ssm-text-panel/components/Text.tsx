
import React, { useEffect, useRef, useState } from 'react';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useDebounce } from 'react-use';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, PanelProps, InterpolateFunction, textUtil, renderTextPanelMarkdown, rangeUtil, TimeRange } from '@grafana/data';
import { CodeEditor, ScrollContainer, useStyles2 } from '@grafana/ui';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Mustache from 'mustache';
import * as beautify from 'beautify';
import escape from 'markdown-escape';
import { useInstance } from 'panels/useInstance';

import { defaultCodeOptions, Options, QueryReport, TextMode, TuningReport, TuningReportImage, TuningSetting } from '../types';
import { humanize } from 'panels/utils';

import reportMD from '../report.md';

interface Props extends PanelProps<Options> { }

export const TextPanel: React.FC<Props> = ({options, timeRange, width, height, replaceVariables, onChangeTimeRange}) => {
  const domRef = useRef<HTMLDivElement | null>(null);

  const instanceData = useInstance(replaceVariables);

  const styles = useStyles2(getStyles);
  const [processed, setProcessed] = useState<Options>({
    mode: options.mode,
    content: processContent(options, replaceVariables),
  });

  const tuningSettings: TuningSetting[] = [
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

  useDebounce(
    () => {
      const content = processContent(options, replaceVariables);
      if (content !== processed.content || options.mode !== processed.mode) {
        setProcessed({
          mode: options.mode,
          content,
        });
      }
    },
    100,
    [options]
  );

  if (processed.mode === TextMode.Code) {
    const code = options.code ?? defaultCodeOptions;
    return (
      <CodeEditor
        key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
        value={processed.content}
        language={code.language ?? defaultCodeOptions.language!}
        width={width}
        height={height}
        containerStyles={styles.codeEditorContainer}
        showMiniMap={code.showMiniMap}
        showLineNumbers={code.showLineNumbers}
        readOnly={true}
      />
    );
  }

  async function tuningReports(zip: JSZip, delay?: number): Promise<TuningReport[]> {
    return new Promise(resolver => setTimeout(async ()=>{
      const reports: TuningReport[] = [];
      const elems = document.body.querySelectorAll<HTMLElement>('span[role="heading"]');
      for (let i = 0; i < elems.length; i++) {
        const elem = elems.item(i);

        const settings = tuningSettings.find(ts => ts.name === elem.innerText);
        if (!settings) continue;

        const rs = await settings.reports(settings.name, elem);
        rs?.forEach(report => {
          zip.file(report.image.filename, report.image.dataURL.split(';base64,')[1], {base64: true});
          reports.push(report);
          reports.map(()=>'').join('|')
        })
      }

      resolver(reports);
    }, delay ?? 5000));
  }

  async function queryReports(timeRange: TimeRange, load: number): Promise<QueryReport[]> {
    return fetch(`/qan-api/qan/summary-queries?begin=${timeRange.from.toISOString().replace(/Z$/, '')}&end=${timeRange.to.toISOString().replace(/Z$/, '')}&load=${load}&${instanceData?.instances.map(instance => `uuids[]=${instance.UUID}`).join('&')}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then<QueryReport[]>(res => res.json())
  }

  useEffect(() => {
    if (!options.report) return;

    (window as any).downloadReport = async ({delay = 5000, from = 'now-7d', to = 'now', load = 0.01}) => {
      if (!instanceData?.instances.length) {
        console.log('instance data is missing or not loaded yet');
        return;
      }

      console.log('generating the report...');

      const timeRange = rangeUtil.convertRawToRange({from: from, to: to});
      onChangeTimeRange({from: timeRange.from.valueOf(), to: timeRange.to.valueOf()})
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });

      const date = (new Date()).toISOString().split('.')[0];
      const filename = `ssm-report-${date}.zip`;
      const zip = new JSZip();

      const tuningPromise = tuningReports(zip, delay);
      const queryPromise = queryReports(timeRange, load);

      const [tReports, qReports] = await Promise.all([tuningPromise, queryPromise]);

      Mustache.escape = function(text) {return text;};
      zip.file(
        'report.md',
        Mustache.render(
          reportMD,
          {
            'tuning_reports': tReports,
            'query_reports': qReports,
            'images_func': function() {
              return `|${this.images.map(()=>'').join('|')}|\n|${this.images.map(()=>':---:').join('|')}|\n|${this.images.map((image: TuningReportImage)=>`![${image.filename}](${image.filename})`).join('|')}|`;
            },
            'abstract_func': function() {
              return escape(this.abstract);
            },
            'example_func': function() {
              return beautify.sql(this.example);
            },
            'percentage_func': function() {
              return humanize(this.percentage, 'percent');
            },
            'query_time_avg_func': function() {
              return humanize(this.query_time_avg, 'time');
            },
            'query_count_func': function() {
              return humanize(this.query_count, 'number');
            }
          }
        )
      );
      zip.generateAsync({ type: 'blob' })
        .then(function (content: Blob) {
          // see FileSaver.js
          saveAs(content, filename);
        });
    };

    return () => {
      delete (window as any).downloadReport;
    };
  }, [timeRange, onChangeTimeRange, instanceData?.instances, options.report]);

  return (
    <div ref={domRef} className={styles.containStrict}>
      <ScrollContainer minHeight="100%">
        <DangerouslySetHtmlContent
          allowRerender
          html={processed.content}
          className={cx('markdown-html', styles.markdownHtml)}
          data-testid="TextPanel-converted-content"
        />
      </ScrollContainer>
    </div>
  );
};

function processContent(options: Options, interpolate: InterpolateFunction): string {
  let { mode, content } = options;

  // Variables must be interpolated before content is converted to markdown so using variables
  // in URLs work properly
  content = interpolate(content, {}, options.code?.language === 'json' ? 'json' : 'html');

  if (!content) {
    return ' ';
  }

  switch (mode) {
    case TextMode.Code:
      break; // nothing
    case TextMode.HTML:
      content = textUtil.sanitizeTextPanelContent(content);
      break;
    case TextMode.Markdown:
    default:
      // default to markdown
      content = renderTextPanelMarkdown(content);
  }

  return content;
}

const getStyles = (theme: GrafanaTheme2) => ({
  codeEditorContainer: css({
    '.monaco-editor .margin, .monaco-editor-background': {
      backgroundColor: theme.colors.background.primary,
    },
  }),
  containStrict: css({
    contain: 'strict',
    height: '100%',
    display: 'flex',
  }),
  markdownHtml: css({
    height: '100%',
  }),
});

const generalTuningReport = async (name: string, row: HTMLElement): Promise<TuningReport[]|undefined> => {
  const rowPanel = row.closest<HTMLElement>('div[id]');
  const graph = rowPanel?.nextElementSibling as HTMLElement;
  const current = graph?.nextElementSibling as HTMLElement;
  const proposed = current?.nextElementSibling as HTMLElement;

  if (!graph || !current || !proposed) return undefined;

  const graphCanvas = await html2canvas(graph, {allowTaint: true, useCORS: true, backgroundColor: 'rgba(0, 0, 0, 0)'});

  const fixedName = name.replaceAll('/', '_or_');
  return [{
    title: name,
    image: {
      filename: `${fixedName}.png`,
      dataURL: graphCanvas.toDataURL("image/png"),
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

  const graphCanvas = await html2canvas(graph, {allowTaint: true, useCORS: true, backgroundColor: 'rgba(0, 0, 0, 0)'});

  const [firstName, secondName] = name.split('/');
  return [{
    title: firstName,
    image: {
      filename: `${firstName}.png`,
      dataURL: graphCanvas.toDataURL("image/png"),
    },
    current: firstCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '',
    proposed: firstProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? ''
  }, {
    title: secondName,
    image: {
      filename: `${secondName}.png`,
      dataURL: graphCanvas.toDataURL("image/png"),
    },
    current: secondCurrent.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? '',
    proposed: secondProposed.querySelector<HTMLElement>('[class$="-panel-content"]')?.innerText ?? ''
  }]
}
