export enum TextMode {
  Code = 'code',
  HTML = 'html',
  Markdown = 'markdown',
}

export enum CodeLanguage {
  Go = 'go',
  Html = 'html',
  Json = 'json',
  Markdown = 'markdown',
  Plaintext = 'plaintext',
  Sql = 'sql',
  Typescript = 'typescript',
  Xml = 'xml',
  Yaml = 'yaml',
}

export interface Options {
  code?: CodeOptions;
  content: string;
  mode: TextMode;
  report?: boolean;
}

export interface CodeOptions {
  /**
   * The language passed to monaco code editor
   */
  language: CodeLanguage;
  showLineNumbers: boolean;
  showMiniMap: boolean;
}

export const defaultCodeOptions: Partial<CodeOptions> = {
  language: CodeLanguage.Plaintext,
  showLineNumbers: false,
  showMiniMap: false,
};

export interface TuningSetting {
  name: string;
  reports(name: string, row: Element): Promise<TuningReport[]|undefined>;
}

export interface TuningReportImage {
  filename: string;
  dataURL: string;
}

export interface TuningReport {
  title: string;
  image: TuningReportImage;
  current: string;
  proposed: string;
}

export interface QueryReport {
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
