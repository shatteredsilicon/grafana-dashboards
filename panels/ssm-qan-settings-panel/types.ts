export interface QanSettingsOptions { }

interface AgentDefaultsMySQLQan {
  LogSlowAdminStatements: boolean;
  LogSlowSlaveStatements: boolean;
  LogQueriesNotUsingIndexes: boolean;
  LogThrottleQueriesNotUsingIndexes: number;
  LogOutput: string;
  LogTimestamps: string;
  SlowQueryLog: boolean;
  SlowQueryLogFile: string;
  LogSlowFilter: string;
  LogSlowRateType: string;
  LogSlowRateLimit: number;
  LogSlowSpStatements: boolean;
  LogSlowVerbosity: string;
  SlowQueryLogUseGlobalControl: string;
  SlowQueryLogAlwaysWriteTime: number;
  PerformanceSchema: boolean;
  PerformanceSchemaDigestsSize: number;
  PerformanceSchemaMaxDigestLength: number;
  LongQueryTime: number;
  MinExaminedRowLimit: number;
}

interface AgentDefaultsQan extends Partial<AgentDefaultsMySQLQan> {
  CollectFrom: string;
  Interval: number;
  MaxSlowLogSize: number;
  RetainSlowLogs?: number;
  SlowLogRotation?: boolean;
  ExampleQueries?: boolean;
  ExampleResolution?: ExampleResolution;
  ReportLimit: number;
  FilterOmit: string[];
  FilterAllow: string[];
}

export interface AgentDefaults {
  qan?: AgentDefaultsQan;
  log?: {
    LogLevel: string;
  };
}

export interface AgentStatus {
  "agent": string;
  "agent-cmd-handler": string;
  "agent-ws": string;
  "agent-ws-link": string;
  "data": string;
  "data-sender": string;
  "data-sender-1d": string;
  "data-sender-7d": string;
  "data-sender-last": string;
  "data-spooler": string;
  "data-spooler-count": string;
  "data-spooler-oldest": string;
  "data-spooler-size": string;
  "data-ws": string;
  "data-ws-link": string;
  "instance": string;
  "instance-mrms": string;
  "instance-repo": string;
  "log": string;
  "log-buf1": string;
  "log-buf2": string;
  "log-chan": string;
  "log-level": string;
  "log-relay": string;
  "log-ws": string;
  "log-ws-link": string;
  "mrm-monitor": string;
  "mrms": string;
  "qan": string;
  "qan-analyzer-mysql-901dd8a4": string;
  "qan-analyzer-mysql-901dd8a4-last-interval": string;
  "qan-analyzer-mysql-901dd8a4-next-interval": string;
  "qan-analyzer-mysql-901dd8a4-worker": string;
  "query": string;
  "Error": string;
}

enum AgentLogLevel {
  LOG_EMERGENCY = 0,
  LOG_ALERT = 1,
  LOG_CRITICAL = 2,
  LOG_ERROR = 3,
  LOG_WARNING = 4,
  LOG_NOTICE = 5,
  LOG_INFO = 6,
  LOG_DEBUG = 7
}

export interface AgentLog {
  Ts: string;
  Level: AgentLogLevel;
  Service: string;
  Msg: string;
}

export enum ExampleResolution {
  OFF = -1,
  DAY = 0,
  HOUR = 1,
  MINUTE = 2
}
