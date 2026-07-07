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

export interface ShowIndexRow {
  Table:        string;
	NonUnique:    boolean;
	KeyName:      string;
	SeqInIndex:   number;
	ColumnName:   string;
	Collation?:    string;
	Cardinality?:  number;
	SubPart?:      number;
	Packed?:       string;
	Null?:         string;
	IndexType:    string;
	Comment?:      string;
	IndexComment?: string;
	Visible?:      string;
}

export enum DBObjectType {
  TypeDBTable = 0,
  TypeDBProcedure,
  TypeDBView
}

export interface QueryInfo {
  Type: DBObjectType;
  Create: string;
  Status: Record<string, any>;
  Index: Record<string, ShowIndexRow[]> | Record<string, PgShowIndexRow>;
  Errors: Array<string>;
}

export interface GuessDB {
  DB: string;
  IsAmbiguous: boolean;
}

export interface QueryInfoResult {
  GuessDB: GuessDB | null;
  Info: Record<string, QueryInfo>;
}

export interface QueryTableMetadata extends Table {
  QueryInfo: QueryInfo;
};
export interface QueryViewMetadata extends Table {
  QueryInfo: QueryInfo;
};
export interface QueryProcedureMetadata extends Procedure {
  QueryInfo: QueryInfo;
};

export interface PgShowIndexRow {
	KeyName:      string;
  IdxScan:      number;
  IdxTupRead:   number;
  IdxTupFetch:  number;
}

export interface QueryMetaData {
  Tables: QueryTableMetadata[] | null;
  Views: QueryViewMetadata[] | null;
  Procedures: QueryProcedureMetadata[] | null;
  GuessDB: GuessDB | null;
}

export interface QueryClass {
  Id: string;
  Abstract: string;
  Fingerprint: string;
  Tables: Array<Table> | null;
  Procedures: Array<Procedure> | null;
  Metadata: QueryMetaData | null;
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