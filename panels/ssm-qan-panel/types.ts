export interface QANOptions {};

export interface QANProfileQueryLog {
  NoData: boolean;
  Point: number | undefined;
}

export interface QANProfileQueryStats {
  Avg: number;
  Cnt: number;
  Max: number;
  Med: number;
  Min: number;
  P5: number;
  P95: number;
  Sum: number;
}

export interface QANProfileQuery {
  Abstract: string;
  Fingerprint: string;
  FirstSeen: Date;
  Id: string;
  InstanceIDs: number[];
  Load: number;
  Log: QANProfileQueryLog[];
  Percentage: number;
  QPS: number;
  Rank: number;
  Stats: QANProfileQueryStats;
}

export interface QANProfileRankBy {
  Limit: number;
  Metric: string;
  Stat: string;
}

export interface QANProfile {
  Begin: Date;
  End: Date;
  InstanceId: string;
  Query: QANProfileQuery[] | null;
  RankBy: QANProfileRankBy;
  TotalQueries: number;
  TotalTime: number;
}

export interface QANMessage {
  Content: string;
};

export interface QueryDetails {
  InstanceId: string;
  Begin: string;
  End: string;
  Query?: QueryClass;
  Example?: QueryExample;
  UserSources: Array<UserSource>;
  Metrics2?: { [key: string]: any };
  Sparks2: Array<{}>;
};

export interface QueryClass {
  Id: string;
  Abstract: string;
  Fingerprint: string;
  Tables: Array<Table> | null;
  Procedures: Array<Procedure> | null;
  FirstSeen: string;
  LastSeen: string;
  Status: string;
};

export interface QueryExample {
  QueryId: string;
  InstanceUUID: string;
  Period: string;
  Ts: string;
  Db: string;
  QueryTime: number;
  Query: string;
  Explain: { String: string } | string;
};

export interface UserSource {
  User: string;
  Host: string;
  FirstSeen: number;
  LastSeen: number;
  Count: number;
}

export interface Table {
  Db: string
  Table: string
}

export interface Procedure {
  DB: string
  Name: string
}