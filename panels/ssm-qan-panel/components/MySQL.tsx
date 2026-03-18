import { Alert, Button, ButtonGroup, Collapse, Icon, InlineField, Input, RenderUserContentAsHTML, Stack, Text, useStyles2 } from "@grafana/ui";
import React, { useEffect, useRef, useState } from "react";
import { QueryDetails } from "../types";
import { css } from "@emotion/css";
import { TimeRange, AppEvents, dateTimeFormat } from "@grafana/data";
// @ts-ignore
import appEvents from 'grafana/app/core/app_events';
import moment from "moment";
import hljs from "highlight.js";
import * as beautify from 'beautify';
import { saveAs } from 'file-saver';
import { cloneDeep } from "lodash";
import { humanize } from "panels/utils";
import { Sparkline } from "panels/Sparkline";
import { LatencyChart } from "panels/LatencyChart";
import { Instance } from "panels/useInstance";

import 'panels/hljs.scss';

// @ts-ignore
import '../../../node_modules/renderjson/renderjson.js';
declare const renderjson: any;

export interface MySQLQueryProps {
  queryID: string;
  timeRange: TimeRange;
  instance: Instance;
  instances: Instance[];
  queryDetails: QueryDetails;
  onSizeChange: ()=>void;
}

enum DBObjectType {
  TypeDBTable = 0,
  TypeDBProcedure,
  TypeDBView
}

interface Table {
  Db: string
  Table: string
}

interface Procedure {
  DB: string
  Name: string
}

interface ShowIndexRow {
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

interface QueryInfo {
  Type: DBObjectType;
  Create: string;
  Status: Record<string, any>;
  Index: Record<string, ShowIndexRow[]>;
  Errors: Array<string>;
}

interface GuessDB {
  DB: string;
  IsAmbiguous: boolean;
}

interface QueryInfoResult {
  GuessDB: GuessDB | null;
  Info: Record<string, QueryInfo>;
}

interface ExplainRow {
	Id?: number;
	SelectType?: string;
	Table?: string;
	Partitions?: string;
	CreateTable?: string;
	Type?: string;
	PossibleKeys?: string;
	Key?: string;
	KeyLen?: string;
	Ref?: string;
	Rows?: number;
	Filtered?: number;
	Extra?: string;
}

interface QueryExplain {
  Classic: ExplainRow[];
  JSON: string;
  json: any;
  TEXT: string;
  Visual: string;
}

interface UserSource {
  User: string;
  Host: string;
  FirstSeen: number;
  LastSeen: number;
  Count: number;
}

const getStyles = () => {
  return {
    collapseLabel: css`
      display: flex;
      flex-direction: row;
      color: #27b2e5;

      h5 {
        font-weight: 500;
        line-height: 1.2;
        font-size: 1.25rem;
      }
    `,
    nonFirstSeen: css`
      color: #d8d9da;
    `,
    firstSeen: css`
      color: #27b2e5;
    `,
    metricsTable: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      border-top: 1px solid #292929;
      border-left: 1px solid #292929;
    `,
    metricsRow: css`
      display: grid;
      grid-template-columns: 2fr 2fr 3fr 2fr;
      min-height: 40px;
      width: 100%;
    `,
    table: css`
      display: table;
      border-collapse: collapse;
      width: 100%;
      border-left: 1px solid #292929;
      border-top: 1px solid #292929;
    `,
    row: css`
      display: table-row;

      &>div {
        display: table-cell;
        height: 100%;
        padding: 5px !important;
        vertical-align: middle;
        border-right: 1px solid #292929;
        border-bottom: 1px solid #292929;

        p {
          margin-bottom: 0;
          white-space: nowrap;
        }
      }
    `,
    cell: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;
      width: 100%;
      border-bottom: 1px solid #292929;
      border-right: 1px solid #292929;
    `,
    header: css`
      background-color: #333333;
    `,
    card: css`
      display: flex;
      justify-content: center;
      background-color: #1f1d1d;
    `,
    textPrimary: css`
      color: #27b2e5;
    `,
    textSuccess: css`
      color: #299c46;
    `,
    unitPerSec: css`
      &:after {
        margin-left: 3px;
        content: '(per sec)';
      }
    `,
    unitAvg: css`
      &:after {
        margin-left: 3px;
        content: 'avg';
      }
    `,
    unitAvgLoad: css`
      &:after {
        margin-left: 3px;
        content: '(avg load)';
      }
    `,
    unitLoad: css`
      &:after {
        margin-left: 3px;
        content: 'load';
      }
    `,
    dataOutput: css`
      min-height: 36px;
      display: flex;
      justify-content: space-between;
      position: relative;
      overflow-y: scroll;

      pre {
        margin-bottom: 0;
        background-color: transparent !important;
        border: none;
      }

      .hljs-buttons {
        position: fixed;
        right: 15px;
        display: flex;
        flex-direction: row;
        gap: 24px;
      }
    `,
    jsonExplain: css`
      .renderjson a              { text-decoration: none; color: #27b2e5; }
      .renderjson .disclosure    { color: crimson; font-size: 150%; }
      .renderjson .syntax        { color: grey; }
      .renderjson .string        { color: red; }
      .renderjson .number        { color: cyan; }
      .renderjson .boolean       { color: plum; }
      .renderjson .key           { color: lightblue; }
      .renderjson .keyword       { color: lightgoldenrodyellow; }
      .renderjson .object.syntax { color: lightseagreen; }
      .renderjson .array.syntax  { color: lightsalmon; }
    `
  }
}

export const MySQLQuery: React.FC<MySQLQueryProps> = (props) => {
  const jsonExplainRef = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles);

  const [tables, setTables] = useState<Table[]>();
  const [views, setViews] = useState<Table[]>();
  const [procedures, setProcedures] = useState<Procedure[]>();
  const [userSources, setUserSources] = useState<UserSource[]>();

  const [collapseOpenState, setCollapseOpenState] = useState<{[key: string]: boolean}>(); // open by default
  const [buttonClicked, setButtonClicked] = useState<{[key: string]: boolean}>();

  const [isQueryInfoLoading, setIsQueryInfoLoading] = useState(false);
  const [isExplainLoading, setIsExplainLoading] = useState(false);
  const [isUserSourceLoading, setIsUserSourceLoading] = useState(false);

  const [queryInfo, setQueryInfo] = useState<QueryInfoResult>();
  const [queryExplain, setQueryExplain] = useState<QueryExplain>();
  const [jsonExplainError, setJSONExplainError] = useState<string>();
  const [userSourceError, setUserSourceError] = useState<string>();

  const [dbTableInput, setDBTableInput] = useState<string>('');
  const [dbViewInput, setDBViewInput] = useState<string>('');
  const [dbProcedureInput, setDBProcedureInput] = useState<string>('');

  const [tableIndex, setTableIndex] = useState<number>(0);
  const [viewIndex, setViewIndex] = useState<number>(0);
  const [procedureIndex, setProcedureIndex] = useState<number>(0);

  useEffect(()=>{
    if (!queryExplain?.json || !jsonExplainRef.current) return;
    renderjson.set_icons('+', '-');
    renderjson.set_show_to_level(collapseOpenState?.['json-explain-pre'] ? 'all' : '');
    jsonExplainRef.current.innerHTML = '';
    jsonExplainRef.current.appendChild(renderjson(queryExplain.json));
  }, [queryExplain?.json, jsonExplainRef?.current, collapseOpenState?.['json'], collapseOpenState?.['json-explain-pre']]);

  useEffect(()=>{
    if (props.instance.Agent?.UUID === undefined || props.instance.UUID === undefined) return;

    getQueryInfo(
      props.instance.Agent.UUID,
      props.instance.UUID
    );
  }, [props.queryDetails.Query, props.instance]);

  useEffect(()=>{
    getUserSources(props.instances.map(i => i.UUID), props.queryID, props.timeRange.from.toISOString().replace(/Z$/, ''), props.timeRange.to.toISOString().replace(/Z$/, ''));
  }, [props.timeRange, props.queryID, props.instances])

  useEffect(()=>{
    if (queryInfo === undefined || props.queryDetails.Example === undefined || props.instance?.Agent?.UUID === undefined || props.instance.UUID === undefined) return;
    
    getQueryExplain(
      props.instance.Agent.UUID,
      props.instance.UUID,
      props.queryDetails.Example.Db || queryInfo.GuessDB?.DB || '',
      props.queryDetails.Example.Query,
      typeof props.queryDetails.Example.Explain === 'string' ? props.queryDetails.Example.Explain : props.queryDetails.Example.Explain.String
    );
  }, [queryInfo, props.queryDetails.Example, props.instance]);

  useEffect(()=>{
    props.onSizeChange();
  }, [isQueryInfoLoading, isExplainLoading, collapseOpenState, tableIndex, viewIndex, procedureIndex]);

  useEffect(()=>{
    if (!jsonExplainRef.current) return;

    const observer = new MutationObserver(() => {
      props.onSizeChange();
    });

    observer.observe(jsonExplainRef.current, {
      attributes: true, // Observe attribute changes
      childList: true,  // Observe direct child additions/removals
      subtree: true,    // Observe changes in descendants as well
      characterData: true // Observe changes to text content
    });

    return () => observer.disconnect();
  }, [jsonExplainRef?.current])

  function fetchQueryInfo(agentUUID: string, dbServerUUID: string, tables: Array<Table>, procedures: Array<Procedure>) {
    const url = `/qan-api/agents/${agentUUID}/cmd`;

    const data = {
      UUID: dbServerUUID,
      Table: tables,
      Index: tables,
      Status: tables,
      Procedure: procedures,
    };

    const params = {
      AgentUUID: agentUUID,
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
  }

  function getQueryInfo(agentUUID: string, dbServerUUID: string) {
    setIsQueryInfoLoading(true);
    fetchQueryInfo(
      agentUUID, dbServerUUID,
      props.queryDetails.Query?.Tables ? props.queryDetails.Query.Tables : [],
      props.queryDetails.Query?.Procedures ? props.queryDetails.Query.Procedures : []
    )
      .then(res => res.json())
      .then(res => JSON.parse(atob(res.Data)))
      .then((res: QueryInfoResult) => {
        if (!props.queryDetails.Example?.Db && res.GuessDB?.DB) {
          props.queryDetails.Query?.Tables?.forEach((t, index, array)=>{
            if (!array[index].Db) array[index].Db = res.GuessDB?.DB!;
          });
          props.queryDetails.Query?.Procedures?.forEach((t, index, array)=>{
            if (!array[index].DB) array[index].DB = res.GuessDB?.DB!;
          });
        }

        const tables = props.queryDetails.Query?.Tables?.filter(t => res.Info?.[`${t.Db}.${t.Table}`] && res.Info?.[`${t.Db}.${t.Table}`].Type === DBObjectType.TypeDBTable) || [];
        const views = props.queryDetails.Query?.Tables?.filter(t => res.Info?.[`${t.Db}.${t.Table}`] && res.Info?.[`${t.Db}.${t.Table}`].Type === DBObjectType.TypeDBView) || [];

        // append underlying tables/views
        Object.entries(res.Info).forEach(([key, item]) => {
          if (props.queryDetails.Query?.Tables?.some(t => `${t.Db}.${t.Table}` === key)) {
            return;
          }

          const dbTable = key.split('.');
          const db = dbTable.length > 1 ? dbTable[0] : (props.queryDetails.Example?.Db || res.GuessDB?.DB || '');
          const table = dbTable.length > 1 ? dbTable[1] : dbTable[0];
          item.Type === DBObjectType.TypeDBTable && tables.push({ Db: db, Table: table })
          item.Type === DBObjectType.TypeDBView && views.push({ Db: db, Table: table })
        })

        setQueryInfo(res);
        setTables(tables);
        setViews(views);
        setProcedures(props.queryDetails.Query?.Procedures?.filter(t => res.Info?.[`${t.DB}.${t.Name}`]));
      })
      .catch(()=>{
        setQueryInfo(undefined);
      })
      .finally(()=>{ setIsQueryInfoLoading(false); })
  }

  function getQueryExplain(agentUUID: string, dbServerUUID: string, dbName: string, query: string, withExplain: string) {
    const url = `/qan-api/agents/${agentUUID}/cmd`;

    const data = {
      UUID: dbServerUUID,
      Db: dbName,
      Query: query,
      Convert: true,  // agent will convert if not SELECT and MySQL <= 5.5 or >= 5.6 but no privs
      WithExplainRows: withExplain ? JSON.parse(withExplain) as ExplainRow[] : []
    };

    const params = {
      AgentUUID: agentUUID,
      Service: 'query',
      Cmd: 'Explain',
      Data: btoa(JSON.stringify(data))
    };

    setIsExplainLoading(true);
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
      .then(res => res.json())
      .then(res => JSON.parse(atob(res.Data)))
      .then((res: QueryExplain) => {
        try {
          res.json = JSON.parse(res.JSON);
          setJSONExplainError(undefined);
        } catch(err: any) {
          setJSONExplainError(err.message);
        }
        setQueryExplain(res);
      })
      .catch(()=>{
        setQueryExplain(undefined);
      })
      .finally(()=>{ setIsExplainLoading(false); })
  }

  function getUserSources(dbServerUUIDs: string[], queryID: string, from: string, to: string) {
    const params = new URLSearchParams();
    params.set('begin', from);
    params.set('end', to);
    dbServerUUIDs.forEach(uuid => {
      params.append('uuids[]', uuid);
    });
    
    setIsUserSourceLoading(true);
    fetch(`/qan-api/qan/query/${queryID}/user-sources?${params.toString()}`)
      .then(res => res.json())
      .then((data: UserSource[]) => {
        const userSourceMap: { [key: string]: UserSource } = {};
        data.forEach(source => {
          var key = source.User+'@'+source.Host;

          if (!userSourceMap[key]) {
            userSourceMap[key] = cloneDeep(source);
          } else {
            userSourceMap[key].Count += source.Count;
            if (source.FirstSeen < userSourceMap[key].FirstSeen) {
              userSourceMap[key].FirstSeen = source.FirstSeen;
            }
            if (source.LastSeen > userSourceMap[key].LastSeen) {
              userSourceMap[key].LastSeen = source.LastSeen;
            }
          }
        });
        setUserSources(Object.values(userSourceMap).sort((a, b) => b.Count - a.Count));
      })
      .catch(() => {
        setUserSourceError("Can't get list of user sources");
      })
      .finally(() => {
        setIsUserSourceLoading(false);
      })
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      appEvents.emit(AppEvents.alertSuccess, [`${key} has been copied to clipboard`]);
      setButtonClicked({...buttonClicked, [key]: true});
      setTimeout(()=>{ setButtonClicked({...buttonClicked, [key]: false}) }, 3000);
    } catch {
      appEvents.emit(AppEvents.alertError, [`Failed to copy ${key} to clipboard`]);
    }
  }

  function toggleCollapse(key: string, defaultState: boolean = false) {
    setCollapseOpenState({...collapseOpenState, [key]: collapseOpenState?.[key] !== undefined ? !collapseOpenState[key] : defaultState});
  }

  function updateTables(queryID: string, dbTables: Array<Table>) {
    const url = `/qan-api/queries/${queryID}/tables`;
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dbTables)
    });
  }

  function updateProcedures(queryID: string, dbProcedures: Array<Procedure>) {
    const url = `/qan-api/queries/${queryID}/procedures`;
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dbProcedures)
    });
  }

  function appendQueryInfo(res: QueryInfoResult) {
    queryInfo?.Info && Object.entries(res.Info).forEach(([k, v])=>{
      if (queryInfo?.Info[k]) return;
      queryInfo.Info[k] = v;
    });
  }

  function parseIdentifier(id: string) {
    const part = id.split('.');
    const db = part[0].replace(/`/g, '');
    const name = part[1].replace(/`/g, '');
    return [db, name];
  }

  function addDBTable() {
    if (dbTableInput.length > 6) {
      const [db, table] = parseIdentifier(dbTableInput);
      if (tables?.some(t => t.Db === db && t.Table === table)) return;
      const newTables = !!props.queryDetails.Query?.Tables?.length ? [...props.queryDetails.Query.Tables, {Db: db, Table: table}] : [{Db: db, Table: table}];
      updateTables(props.queryID, newTables)
        .then(res=>{
          if (!res.ok) return;
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, newTables, [])
            .then(res => res.json())
            .then(res => JSON.parse(atob(res.Data)))
            .then((res: QueryInfoResult) => {
              appendQueryInfo(res);
              setTables([...(!!tables?.length ? tables : []), {Db: db, Table: table}]);
              setDBTableInput('');
            });
        })
    }
  }

  function deleteDBTable(index: number) {
    const dbTable = tables?.[index];
    if (!dbTable || !props.queryDetails.Query?.Tables) return;
    const newTables: Table[] = props.queryDetails.Query.Tables.filter(t => t.Db !== dbTable.Db || t.Table !== dbTable.Table);
    updateTables(props.queryID, newTables)
      .then(res=>{
        if (!res.ok) return;
        setTables([...tables.slice(0, index), ...tables.slice(index+1)]);
        tableIndex >= index && setTableIndex(tableIndex - 1);
      })
  }

  function addDBView() {
    if (dbViewInput.length > 6) {
      const [db, name] = parseIdentifier(dbViewInput);
      if (views?.some(t => t.Db === db && t.Table === name)) return;
      const newTables = !!props.queryDetails.Query?.Tables?.length ? [...props.queryDetails.Query.Tables, {Db: db, Table: name}] : [{Db: db, Table: name}];
      updateTables(props.queryID, newTables)
        .then(res=>{
          if (!res.ok) return;
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, newTables, [])
            .then(res => res.json())
            .then(res => JSON.parse(atob(res.Data)))
            .then((res: QueryInfoResult) => {
              appendQueryInfo(res);
              setViews([...(!!tables?.length ? tables : []), {Db: db, Table: name}]);
              setDBViewInput('');
            });
        })
    }
  }

  function deleteDBView(index: number) {
    const dbTable = views?.[index];
    if (!dbTable || !props.queryDetails.Query?.Tables) return;
    const newTables: Table[] = props.queryDetails.Query.Tables.filter(t => t.Db !== dbTable.Db || t.Table !== dbTable.Table);
    updateTables(props.queryID, newTables)
      .then(res=>{
        if (!res.ok) return;
        setViews([...views.slice(0, index), ...views.slice(index+1)]);
        viewIndex >= index && setViewIndex(viewIndex - 1);
      })
  }

  function addDBProcedure() {
    if (dbProcedureInput.length > 6) {
      const [db, name] = parseIdentifier(dbProcedureInput);
      if (procedures?.some(t => t.DB === db && t.Name === name)) return;
      const newProcedures = !!procedures?.length ? [...procedures] : [];
      newProcedures.push({DB: db, Name: name});
      updateProcedures(props.queryID, newProcedures)
        .then(res=>{
          if (!res.ok) return;
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, [], newProcedures)
            .then(res => res.json())
            .then(res => JSON.parse(atob(res.Data)))
            .then((res: QueryInfoResult) => {
              appendQueryInfo(res);
              setProcedures(newProcedures);
              setDBProcedureInput('');
            });
        })
    }
  }

  function deleteDBProcedure(index: number) {
    const newProcedures = !!procedures?.length ? [...procedures] : [];
    newProcedures.splice(index, 1);
    updateProcedures(props.queryID, newProcedures)
      .then(res=>{
        if (!res.ok) return;
        setProcedures(newProcedures);
        procedureIndex >= index && setProcedureIndex(procedureIndex - 1);
      })
  }

  function downloadReport() {
    const date = dateTimeFormat(new Date(), { format: 'YYYY-MM-DDTHH:mm:ss' });
    const filename = `ssm-${props.instance.Name}-${date}-query-${props.queryID}-report.json`;
    const data = {
      'Query': props.queryDetails.Example?.Query,
      'Explain': queryExplain?.Classic,
      'Tables': tables?.map(table => {
        return {
          'Db': table.Db,
          'Table': table.Table,
          'Create': queryInfo?.Info[`${table.Db}.${table.Table}`]?.Create,
          'Index': queryInfo?.Info[`${table.Db}.${table.Table}`]?.Index
        };
      }),
      'Views': views?.map(view => {
        return {
          'Db': view.Db,
          'Name': view.Table,
          'Create': queryInfo?.Info[`${view.Db}.${view.Table}`]?.Create,
          'Index': queryInfo?.Info[`${view.Db}.${view.Table}`]?.Index
        }
      }),
      'Prodecures': procedures?.map(procedure => {
        return {
          'Db': procedure.DB,
          'Name': procedure.Name,
          'Create': queryInfo?.Info[`${procedure.DB}.${procedure.Name}`]?.Create,
          'Index': queryInfo?.Info[`${procedure.DB}.${procedure.Name}`]?.Index
        }
      })
    };
    const blob = new Blob([JSON.stringify(data, null, 4)], {type: "application/octet-stream"});
    saveAs(blob, filename);
  }

  return (
    <Stack direction='column' width='100%' gap={2}>
      <Stack direction='row' justifyContent='space-between'>
        <Text element='h3'>{props.queryDetails.Query !== undefined ? props.queryDetails.Query.Abstract : 'Server Summary'}</Text>
        {props.queryDetails.Query?.Id && <Text element='h3'>{props.queryDetails.Query.Id}</Text>}
      </Stack>
      <Collapse
        isOpen={collapseOpenState?.['Metrics'] || true}
        onToggle={()=>toggleCollapse('Metrics')}
        label={
          <div className={styles.collapseLabel}>
            <h5>Metrics</h5>
            {props.queryDetails.Query?.FirstSeen && props.queryDetails.Query?.LastSeen &&
              (()=>{
                const firstSeen = moment(props.queryDetails.Query.FirstSeen);
                const lastSeen = moment(props.queryDetails.Query.LastSeen);
                return (
                  <span>
                    &nbsp;Query first seen: <strong className={firstSeen.unix() < props.timeRange.from.unix() ? styles.nonFirstSeen : styles.firstSeen }>{ firstSeen.calendar(null, {sameElse: 'lll'}) }</strong>
                    &nbsp;Last seen: <strong>{ lastSeen.calendar(null, {sameElse: 'lll'}) }</strong>
                  </span>
                )
              })()
            }
          </div>
        }
        className={styles.card}
        collapsible
      >
        <div className={styles.metricsTable}>
          <div className={`${styles.metricsRow} ${styles.header}`}>
            <div className={styles.cell}>Metrics</div>
            <div className={styles.cell}>Rate/Sec</div>
            <div className={styles.cell}>Sum</div>
            <div className={styles.cell}>Per Query Stats</div>
          </div>
          <div className={styles.metricsRow}>
            <div className={styles.cell}>Query Count</div>
            <div className={styles.cell}>
              <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Query_count_per_sec'], 'number')}</span>
              <Sparkline
                width={100}
                height={20}
                xkey="Ts"
                ykey="Query_count_per_sec"
                measurement="number"
                data={props.queryDetails.Sparks2}
              />
            </div>
            <div className={styles.cell}>
              <span>
                {humanize(props.queryDetails.Metrics2?.['Query_count'], 'number')}
                <small className={styles.textPrimary}>
                  &nbsp;{humanize(props.queryDetails.Metrics2?.['Query_count_of_total'], 'percent')} of total
                </small>
              </span>
            </div>
            <div className={styles.cell}>
              <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Query_time_avg'], 'time')}</span>
              <LatencyChart
                width={100}
                height={20}
                measurement='time'
                metricPrefix='Query_time'
                data={props.queryDetails.Metrics2 || {}}
              />
            </div>
          </div>
          <div className={styles.metricsRow}>
            <div className={styles.cell}>Query Time</div>
            <div className={styles.cell}>
              <span className={styles.unitLoad}>{humanize(props.queryDetails.Metrics2?.['Query_time_sum_per_sec'], 'number')}</span>
              <Sparkline
                width={100}
                height={20}
                xkey="Ts"
                ykey="Query_time_sum_per_sec"
                measurement="number"
                data={props.queryDetails.Sparks2}
              />
            </div>
            <div className={styles.cell}>
              <span>
                {humanize(props.queryDetails.Metrics2?.['Query_time_sum'], 'time')}
                <small className={styles.textPrimary}>
                  &nbsp;{humanize(props.queryDetails.Metrics2?.['Query_time_sum_of_total'], 'percent')} of total
                </small>
              </span>
            </div>
            <div className={styles.cell}>
              <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Query_time_avg'], 'time')}</span>
              <LatencyChart
                width={100}
                height={20}
                measurement='time'
                metricPrefix='Query_time'
                data={props.queryDetails.Metrics2 || {}}
              />
            </div>
          </div>
          {props.queryDetails.Metrics2?.['Lock_time_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Lock Time</div>
              <div className={styles.cell}>
                <span className={styles.unitAvgLoad}>{humanize(props.queryDetails.Metrics2?.['Lock_time_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Lock_time_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Lock_time_sum'], 'time')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Lock_time_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Lock_time_avg_per_query_time'], 'percent')} of query time
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Lock_time_avg'], 'time')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='time'
                  metricPrefix='Lock_time'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb Row Lock Wait</div>
              <div className={styles.cell}>
                <span className={styles.unitAvgLoad}>{humanize(props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="InnoDB_rec_lock_wait_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_sum'], 'time')}
                  <small>
                    {props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_sum_of_total'] !== undefined &&
                      <span className={styles.textPrimary}>
                        &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_sum_of_total'], 'percent')} of total
                      </span>
                    }
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_avg_per_query_time'], 'percent')} of query time
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_rec_lock_wait_avg'], 'time')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='time'
                  metricPrefix='InnoDB_rec_lock_wait'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb IO Read Wait</div>
              <div className={styles.cell}>
                <span className={styles.unitAvgLoad}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="InnoDB_IO_r_wait_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_sum'], 'time')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_avg_per_query_time'], 'percent')} of query time
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_wait_avg'], 'time')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='time'
                  metricPrefix='InnoDB_IO_r_wait'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_queue_wait_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb Queue Wait</div>
              <div className={styles.cell}>
                <span className={styles.unitAvgLoad}>{humanize(props.queryDetails.Metrics2?.['InnoDB_queue_wait_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="InnoDB_queue_wait_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['InnoDB_queue_wait_sum'], 'time')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_queue_wait_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_queue_wait_avg_per_query_time'], 'percent')} of query time
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_queue_wait_avg'], 'time')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='time'
                  metricPrefix='InnoDB_queue_wait'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_IO_r_ops_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb Read Ops</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_ops_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="InnoDB_IO_r_ops_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_ops_sum'], 'number')}
                  <small className={styles.textPrimary}>
                    &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_ops_sum_of_total'], 'percent')} of total
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_ops_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='InnoDB_IO_r_ops'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb Read Bytes</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_sum_per_sec'], 'size')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="InnoDB_IO_r_bytes_sum_per_sec"
                  measurement="size"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_sum'], 'size')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={`${styles.textSuccess} ${styles.unitAvg}`}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_sum_per_io'], 'size')} io size
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_IO_r_bytes_avg'], 'size')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='size'
                  metricPrefix='InnoDB_IO_r_bytes'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['InnoDB_pages_distinct_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Innodb Distinct Pages</div>
              <div className={styles.cell}>-</div>
              <div className={styles.cell}>-</div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['InnoDB_pages_distinct_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='InnoDB_pages_distinct'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['QC_Hit_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Query Cache Hits</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['QC_Hit_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="QC_Hit_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['QC_Hit_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['QC_Hit_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['QC_Hit_sum_per_query'], 'percent')} QC hit ratio
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Rows_sent_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Rows Sent</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Rows_sent_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Rows_sent_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Rows_sent_sum'], 'number')}
                  <small className={styles.textPrimary}>
                    &nbsp;{humanize(props.queryDetails.Metrics2?.['Rows_sent_sum_of_total'], 'percent')} of total
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Rows_sent_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Rows_sent'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Bytes_sent_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Bytes Sent</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Bytes_sent_sum_per_sec'], 'size')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Bytes_sent_sum_per_sec"
                  measurement="size"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Bytes_sent_sum'], 'size')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Bytes_sent_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Bytes_sent_sum_per_rows'], 'size')} bytes/row
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Bytes_sent_avg'], 'size')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='size'
                  metricPrefix='Bytes_sent'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Rows_examined_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Rows Examined</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Rows_examined_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Rows_examined_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Rows_examined_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Rows_examined_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Rows_examined_sum_per_rows'], 'percent')} per row sent
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Rows_examined_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Rows_examined'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Rows_affected_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Rows Affected</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Rows_affected_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Rows_affected_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Rows_affected_sum'], 'number')}
                  <small className={styles.textPrimary}>
                    &nbsp;{humanize(props.queryDetails.Metrics2?.['Rows_affected_sum_of_total'], 'percent')} of total
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Rows_affected_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Rows_affected'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Filesort_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>External Sorts<small>(Filesort)</small></div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Filesort_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Filesort_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Filesort_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Filesort_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Filesort_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Filesort_on_disk_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>External Sorts of Disk<small>(Filesort on disk)</small></div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Filesort_on_disk_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Filesort_on_disk_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Filesort_on_disk_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Filesort_on_disk_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Filesort_on_disk_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Merge_passes_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>External Sort Passes<small>(Merge Passes)</small></div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Merge_passes_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Merge_passes_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Merge_passes_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Merge_passes_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Merge_passes_sum_per_external_sort'], 'percent')} per external sort
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Merge_passes_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Merge_passes'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Full_join_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Cartesian Products<small>(Full Joins)</small></div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Full_join_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Full_join_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Full_join_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Full_join_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Full_join_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Full_scan_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Full Table Scans</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Full_scan_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Full_scan_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Full_scan_sum'], 'time')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Full_scan_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Full_scan_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Tmp_table_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Queries Requiring Tmp Table In Memory</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Tmp_table_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Tmp_table_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Tmp_table_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Tmp_tables_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Number of Tmp table in Memory</div>
              <div className={styles.cell}>
                <span>{humanize(props.queryDetails.Metrics2?.['Tmp_tables_sum_per_sec'], 'number')} (per sec)</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Tmp_tables_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Tmp_tables_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_tables_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_tables_sum_per_query_with_tmp_table'], 'percent')} per query with tmp table
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Tmp_tables_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Tmp_tables'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Tmp_table_on_disk_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Queries Requiring Tmp Table on Disk</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Tmp_table_on_disk_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Tmp_table_on_disk_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Tmp_table_on_disk_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_on_disk_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_on_disk_sum_per_query'], 'percent')} of queries
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>-</div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Tmp_disk_tables_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Number of Tmp Tables on Disk</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Tmp_disk_tables_sum_per_sec'], 'number')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Tmp_disk_tables_sum_per_sec"
                  measurement="number"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Tmp_disk_tables_sum'], 'number')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_disk_tables_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_disk_tables_sum_per_query_with_tmp_table'], 'percent')} per query with disk tmp table
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Tmp_disk_tables_avg'], 'number')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='number'
                  metricPrefix='Tmp_disk_tables'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
          {props.queryDetails.Metrics2?.['Tmp_table_sizes_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Total Size of Tmp Tables</div>
              <div className={styles.cell}>
                <span className={styles.unitPerSec}>{humanize(props.queryDetails.Metrics2?.['Tmp_table_sizes_sum_per_sec'], 'size')}</span>
                <Sparkline
                  width={100}
                  height={20}
                  xkey="Ts"
                  ykey="Tmp_table_sizes_sum_per_sec"
                  measurement="size"
                  data={props.queryDetails.Sparks2}
                />
              </div>
              <div className={styles.cell}>
                <span>
                  {humanize(props.queryDetails.Metrics2?.['Tmp_table_sizes_sum'], 'size')}
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_sizes_sum_of_total'], 'percent')} of total
                    </span>
                    <span className={styles.textSuccess}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Tmp_table_sizes_sum_per_query_with_any_tmp_table'], 'percent')} per query
                    </span>
                  </small>
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.unitAvg}>{humanize(props.queryDetails.Metrics2?.['Tmp_table_sizes_avg'], 'size')}</span>
                <LatencyChart
                  width={100}
                  height={20}
                  measurement='size'
                  metricPrefix='Tmp_table_sizes'
                  data={props.queryDetails.Metrics2 || {}}
                />
              </div>
            </div>
          }
        </div>
      </Collapse>
      {props.queryDetails.Query !== undefined && (
        <>
          <Stack direction='row' justifyContent='flex-start'>
            <Text element='h3'>QUERY</Text>
          </Stack>
          <Collapse
            isOpen={collapseOpenState?.['fingerprint'] === undefined ? true : collapseOpenState['fingerprint']}
            onToggle={()=>toggleCollapse('fingerprint')}
            label={
              <div className={styles.collapseLabel}>
                <h5>Fingerprint</h5>
              </div>
            }
            className={styles.card}
            collapsible
          >
            <div className={styles.dataOutput}>
              <pre>
                <code dangerouslySetInnerHTML={{ __html: hljs.highlight(beautify.sql(props.queryDetails.Query.Fingerprint), {language: 'sql'}).value}}></code>
              </pre>
              <div className='hljs-buttons'>
                <button className={'hljs-button' + (buttonClicked?.['Fingerprint'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('Fingerprint', props.queryDetails.Query?.Fingerprint || '')}>Copy to clipboard</button>
              </div>
            </div>
          </Collapse>
          {props.queryDetails.Example !== undefined && props.queryDetails.Example.Query.length > 0 &&
            <Collapse
              isOpen={collapseOpenState?.['example'] === undefined ? true : collapseOpenState['example']}
              onToggle={()=>toggleCollapse('example')}
              label={
                <div className={styles.collapseLabel}>
                  <h5>Example</h5>
                </div>
              }
              className={styles.card}
              collapsible
            >
              <div className={styles.dataOutput}>
                <pre>
                  <code dangerouslySetInnerHTML={{ __html: hljs.highlight(beautify.sql(props.queryDetails.Example.Query), {language: 'sql'}).value}}></code>
                </pre>
                <div className='hljs-buttons'>
                  <button className={'hljs-button' + (buttonClicked?.['Example'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('Example', props.queryDetails.Example?.Query || '')}>Copy to clipboard</button>
                </div>
              </div>
            </Collapse>
          }
          {isQueryInfoLoading
            ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
            : queryInfo !== undefined && !!queryInfo.Info
              ? <>
                  {props.queryDetails.Example?.Query !== undefined &&
                    <>
                      <Stack direction='row' justifyContent='flex-start'>
                        <Text element='h3'>EXPLAIN</Text>
                      </Stack>
                      <Collapse
                        isOpen={collapseOpenState?.['classic'] === undefined ? true : collapseOpenState['classic']}
                        onToggle={()=>toggleCollapse('classic')}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>CLASSIC</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {isExplainLoading
                          ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
                          : !!queryExplain?.Classic
                              ? <div className={styles.table}>
                                  <div className={`${styles.row} ${styles.header}`}>
                                    <div>Id</div>
                                    <div>SelectType</div>
                                    <div>Table</div>
                                    <div>Partitions</div>
                                    <div>CreateTable</div>
                                    <div>Type</div>
                                    <div>PossibleKeys</div>
                                    <div>Key</div>
                                    <div>KeyLen</div>
                                    <div>Ref</div>
                                    <div>Rows</div>
                                    <div>Extra</div>
                                  </div>
                                  {queryExplain?.Classic.map((classic) => {
                                    return (
                                      <div className={styles.row}>
                                        <div>{classic.Id}</div>
                                        <div>{classic.SelectType}</div>
                                        <div>{classic.Table}</div>
                                        <div>{classic.Partitions}</div>
                                        <div>{classic.CreateTable}</div>
                                        <div>{classic.Type}</div>
                                        <div>
                                          {(
                                            queryExplain.json?.['query_block']?.['table']?.['possible_keys'] as string[]
                                            || queryExplain.json?.['query_block']?.['nested_loop']?.[0]?.['table']?.['possible_keys'] as string[]
                                            || classic.PossibleKeys?.split(',')
                                          )?.map((k,i, array) => {
                                            return (
                                              <p>{k}{i<array.length-1 && <span>,&nbsp;</span>}</p>
                                            );
                                          })}
                                        </div>
                                        <div>{
                                          classic.Key?.split(',')?.map((k,i,array)=>{
                                            return (
                                              <p>{k}{i<array.length-1 && <span>,&nbsp;</span>}</p>
                                            );
                                          })
                                        }</div>
                                        <div>{classic.KeyLen}</div>
                                        <div>{classic.Ref}</div>
                                        <div>{classic.Rows}</div>
                                        <div>{classic.Extra}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'><Alert title='' severity='warning'>This type of query is not supported for EXPLAIN</Alert></Stack>
                                </Stack>
                        }
                      </Collapse>
                      <Collapse
                        isOpen={collapseOpenState?.['json']}
                        onToggle={()=>toggleCollapse('json', true)}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>JSON</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {isExplainLoading
                          ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
                          : !!queryExplain?.JSON
                              ? queryExplain?.json
                                ? <div className={styles.dataOutput} onClick={()=>props.onSizeChange()}>
                                    <div ref={jsonExplainRef} className={styles.jsonExplain}></div>
                                    <div className='hljs-buttons'>
                                      <button className={'hljs-button' + (collapseOpenState?.['json-explain-pre'] ? ' hljs-button-clicked' : '')} onClick={()=>toggleCollapse('json-explain-pre', true)}>{collapseOpenState?.['json-explain-pre'] ? 'Collapse All' : 'Expand All'}</button>
                                      <button className={'hljs-button' + (buttonClicked?.['JSON explain'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('JSON explain', JSON.stringify(queryExplain.json))}>Copy to clipboard</button>
                                    </div>
                                  </div>
                                : <Stack direction='row' justifyContent='center'>
                                    <Stack minWidth='40%' maxWidth='80%'><Alert title='' severity='warning'>{jsonExplainError}</Alert></Stack>
                                  </Stack>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'><Alert title='' severity='warning'>This type of query is not supported for EXPLAIN</Alert></Stack>
                                </Stack>
                        }
                      </Collapse>
                      <Collapse
                        isOpen={collapseOpenState?.['visual']}
                        onToggle={()=>toggleCollapse('visual', true)}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>VISUAL</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {isExplainLoading
                          ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
                          : !!queryExplain?.Visual
                              ? <div className={styles.dataOutput}>
                                  <pre>{queryExplain?.Visual}</pre>
                                  <div className='hljs-buttons'>
                                    <button className={'hljs-button' + (buttonClicked?.['VISUAL explain'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('VISUAL explain', queryExplain?.Visual || '')}>Copy to clipboard</button>
                                  </div>
                                </div>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'><Alert title='' severity='warning'>This type of query is not supported for EXPLAIN</Alert></Stack>
                                </Stack>
                        }
                      </Collapse>
                    </>
                  }
                  {!!tables?.length &&
                    <>
                      <Stack direction='row' justifyContent='space-between' width='100%' alignItems='center' wrap gap={1}>
                        <Text element='h3'>TABLES</Text>
                        <InlineField label='DB and table'>
                          <Input width={40} value={dbTableInput} addonAfter={<Button variant='secondary' fill='outline' onClick={()=>addDBTable()}>ADD</Button>} placeholder='`database-name`.`table-name`' onChange={e=>setDBTableInput(e.currentTarget.value)} />
                        </InlineField>
                      </Stack>
                      <Stack direction='row' justifyContent='flex-start' wrap gap={2}>
                        {tables.map((t,i) => (
                          <ButtonGroup>
                            <Button fill={tableIndex === i ? 'solid' : 'outline'} variant='secondary' onClick={()=>setTableIndex(i)}>{`${t.Db}.${t.Table}`}</Button>
                            <Button fill={tableIndex === i ? 'solid' : 'outline'} variant='secondary' icon='times' onClick={() => deleteDBTable(i)} />
                          </ButtonGroup>
                        ))}
                      </Stack>
                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Create || queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors?.find(e => e.startsWith('SHOW CREATE TABLE'))
                        ? <Collapse
                            isOpen={collapseOpenState?.['table-create'] === undefined ? true : collapseOpenState['table-create']}
                            onToggle={()=>toggleCollapse('table-create')}
                            label={
                              <div className={styles.collapseLabel}>
                                <h5>CREATE</h5>
                              </div>
                            }
                            className={styles.card}
                            collapsible
                          >
                            {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Create
                              ? <div className={styles.dataOutput}>
                                  <pre>
                                    <code>
                                      <RenderUserContentAsHTML content={hljs.highlight(queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Create, {language: 'sql'}).value} />
                                    </code>
                                  </pre>
                                  <div className='hljs-buttons'>
                                    <button className={'hljs-button' + (buttonClicked?.['CREATE TABLE'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('CREATE TABLE', queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Create)}>Copy to clipboard</button>
                                  </div>
                                </div>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'>
                                    <Alert title='' severity='warning'>
                                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors.find(e => e.startsWith('SHOW CREATE TABLE'))}
                                    </Alert>
                                  </Stack>
                                </Stack>
                            }
                          </Collapse>
                        : <></>
                      }
                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Status || queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors?.find(e => e.startsWith('SHOW TABLE STATUS'))
                        ? <Collapse
                            isOpen={collapseOpenState?.['status'] === undefined ? true : collapseOpenState['status']}
                            onToggle={()=>toggleCollapse('status')}
                            label={
                              <div className={styles.collapseLabel}>
                                <h5>STATUS</h5>
                              </div>
                            }
                            className={styles.card}
                            collapsible
                          >
                            {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Status
                              ? <div className={styles.table}>
                                  <div className={`${styles.row} ${styles.header}`}>
                                    <div>Name</div>
                                    <div>Value</div>
                                  </div>
                                  {Object.entries(queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Status).map(([k, v]) => {
                                    return (
                                      <div className={styles.row}>
                                        <div>{k}</div>
                                        <div>{
                                          ['AvgRowLength', 'DataLength', 'IndexLength', 'DataFree', 'MaxDataLength'].indexOf(k) !== -1
                                            ? humanize(v, 'size')
                                            : k === 'Rows'
                                              ? humanize(v, 'number')
                                              : v === null
                                                ? '-'
                                                : v
                                        }</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'>
                                    <Alert title='' severity='warning'>
                                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors.find(e => e.startsWith('SHOW TABLE STATUS'))}
                                    </Alert>
                                  </Stack>
                                </Stack>
                            }
                          </Collapse>
                        : <></>
                      }
                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Index || queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors?.find(e => e.startsWith('SHOW INDEX FROM'))
                        ? <Collapse
                            isOpen={collapseOpenState?.['indexes'] === undefined ? true : collapseOpenState['indexes']}
                            onToggle={()=>toggleCollapse('indexes')}
                            label={
                              <div className={styles.collapseLabel}>
                                <h5>INDEXES</h5>
                              </div>
                            }
                            className={styles.card}
                            collapsible
                          >
                            {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Index
                              ? <div className={styles.table}>
                                  <div className={`${styles.row} ${styles.header}`}>
                                    <div>KeyName</div>
                                    <div>Type</div>
                                    <div>Unique</div>
                                    <div>Packed</div>
                                    <div>Column</div>
                                    <div>Cardinality</div>
                                    <div>Collation</div>
                                    <div>Null</div>
                                    <div>Comment</div>
                                  </div>
                                  {Object.entries(queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Index).map(([k, indexes]) => indexes.map((index, i) => {
                                    return (
                                      <div className={styles.row}>
                                        <div>{ i === 0 ? k : ''}</div>
                                        <div>{ i === 0 ? index.IndexType : ''}</div>
                                        <div>{ i === 0 ? (index.NonUnique === false ? 'Yes' : 'No') : '' }</div>
                                        <div>{ i === 0 ? (index.Packed ? 'Yes' : 'No') : ''}</div>
                                        <div>{ index.ColumnName }</div>
                                        <div>{ index.Cardinality }</div>
                                        <div>{ index.Collation }</div>
                                        <div>{ index.Null ? 'Yes' : 'No' }</div>
                                        <div>{ i === 0 ? index.Comment : '' }</div>
                                      </div>
                                    );
                                  }))}
                                </div>
                              : <Stack direction='row' justifyContent='center'>
                                  <Stack minWidth='40%' maxWidth='80%'>
                                    <Alert title='' severity='warning'>
                                      {queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`]?.Errors.find(e => e.startsWith('SHOW INDEX FROM'))}
                                    </Alert>
                                  </Stack>
                                </Stack>
                            }
                          </Collapse>
                        : <></>
                      }
                    </>
                  }
                  {!!procedures?.length &&
                    <>
                      <Stack direction='row' justifyContent='space-between' width='100%' alignItems='center' wrap gap={1}>
                        <Text element='h3'>PROCEDURES</Text>
                        <InlineField label='DB and name'>
                          <Input width={40} value={dbProcedureInput} addonAfter={<Button variant='secondary' fill='outline' onClick={()=>addDBProcedure()}>ADD</Button>} placeholder='`database-name`.`procedure-name`' onChange={e=>setDBProcedureInput(e.currentTarget.value)} />
                        </InlineField>
                      </Stack>
                      <Stack direction='row' justifyContent='flex-start' gap={2}>
                        {procedures.map((t,i) => (
                          <ButtonGroup>
                            <Button fill={procedureIndex === i ? 'solid' : 'text'} variant='secondary' onClick={()=>setProcedureIndex(i)}>{`${t.DB}.${t.Name}`}</Button>
                            <Button fill={procedureIndex === i ? 'solid' : 'text'} variant='secondary' icon='times' onClick={() => deleteDBProcedure(i)} />
                          </ButtonGroup>
                        ))}
                      </Stack>
                      <Collapse
                        isOpen={collapseOpenState?.['procedure-create'] === undefined ? true : collapseOpenState['procedure-create']}
                        onToggle={()=>toggleCollapse('procedure-create')}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>CREATE</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {queryInfo.Info[`${procedures[procedureIndex].DB}.${procedures[procedureIndex].Name}`].Create
                          ? <div className={styles.dataOutput}>
                              <pre>
                                <code>
                                  <RenderUserContentAsHTML content={hljs.highlight(queryInfo.Info[`${procedures[procedureIndex].DB}.${procedures[procedureIndex].Name}`].Create, {language: 'sql'}).value} />
                                </code>
                              </pre>
                              <div className='hljs-buttons'>
                                <button className={'hljs-button' + (buttonClicked?.['CREATE PROCEDURE'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('CREATE PROCEDURE', queryInfo.Info[`${procedures[procedureIndex].DB}.${procedures[procedureIndex].Name}`].Create || '')}>Copy to clipboard</button>
                              </div>
                            </div>
                          : <Stack direction='row' justifyContent='center'>
                              <Stack minWidth='40%' maxWidth='80%'>
                                <Alert title='' severity='warning'>
                                  {queryInfo.Info[`${procedures[procedureIndex].DB}.${procedures[procedureIndex].Name}`]?.Errors.find(e => e.startsWith('SHOW CREATE PROCEDURE'))}
                                </Alert>
                              </Stack>
                            </Stack>
                        }
                      </Collapse>
                    </>
                  }
                  {!!views?.length &&
                    <>
                      <Stack direction='row' justifyContent='space-between' width='100%' alignItems='center' gap={1}>
                        <Text element='h3'>VIEWS</Text>
                        <InlineField label='DB and name'>
                          <Input width={40} value={dbViewInput} addonAfter={<Button variant='secondary' fill='outline' onClick={()=>addDBView()}>ADD</Button>} placeholder='`database-name`.`view-name`' onChange={e=>setDBViewInput(e.currentTarget.value)} />
                        </InlineField>
                      </Stack>
                      <Stack direction='row' justifyContent='flex-start' gap={2}>
                        {views.map((t, i) => (
                          <ButtonGroup>
                            <Button fill={viewIndex === i ? 'solid' : 'text'} variant='secondary' onClick={()=>setViewIndex(i)}>{`${t.Db}.${t.Table}`}</Button>
                            <Button fill={viewIndex === i ? 'solid' : 'outline'} variant='secondary' icon='times' onClick={() => deleteDBView(i)} />
                          </ButtonGroup>
                        ))}
                      </Stack>
                      <Collapse
                        isOpen={collapseOpenState?.['view-create'] === undefined ? true : collapseOpenState['view-create']}
                        onToggle={()=>toggleCollapse('view-create')}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>CREATE</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {queryInfo.Info[`${views[viewIndex].Db}.${views[viewIndex].Table}`].Create
                          ? <div className={styles.dataOutput}>
                              <pre>
                                <code>
                                  <RenderUserContentAsHTML content={hljs.highlight(queryInfo.Info[`${views[viewIndex].Db}.${views[viewIndex].Table}`].Create, {language: 'sql'}).value} />
                                </code>
                              </pre>
                              <div className='hljs-buttons'>
                                <button className={'hljs-button' + (buttonClicked?.['CREATE VIEW'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('CREATE VIEW', queryInfo.Info[`${views[viewIndex].Db}.${views[viewIndex].Table}`].Create)}>Copy to clipboard</button>
                              </div>
                            </div>
                          : <Stack direction='row' justifyContent='center'>
                              <Stack minWidth='40%' maxWidth='80%'>
                                <Alert title='' severity='warning'>
                                  {queryInfo.Info[`${views[viewIndex].Db}.${views[viewIndex].Table}`]?.Errors.find(e => e.startsWith('SHOW CREATE TABLE'))}
                                </Alert>
                              </Stack>
                            </Stack>
                        }
                      </Collapse>
                    </>
                  }
                </>
              : <></>
          }
        </>
      )}
      <Stack direction='row' justifyContent='flex-start'>
        <Text element='h3'>User Sources</Text>
      </Stack>
      <Collapse
        isOpen={collapseOpenState?.['user-source'] === undefined ? true : collapseOpenState['user-source']}
        onToggle={()=>toggleCollapse('user-source')}
        label={
          <div className={styles.collapseLabel}>
            <h5>ACCOUNTS</h5>
          </div>
        }
        className={styles.card}
        collapsible
      >
        {isUserSourceLoading
          ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
          : userSourceError
              ? <Stack direction='row' justifyContent='center'>
                  <Stack minWidth='40%' maxWidth='80%'><Alert title='' severity='warning'>{userSourceError}</Alert></Stack>
                </Stack>
              : <div className={styles.table}>
                  <div className={`${styles.row} ${styles.header}`}>
                    <div>User</div>
                    <div>Host</div>
                    <div>First Seen</div>
                    <div>Last Seen</div>
                    <div>Count</div>
                  </div>
                  {userSources?.map(us => {
                    return (
                      <div className={styles.row}>
                        <div>{us.User}</div>
                        <div>{us.Host}</div>
                        <div>{dateTimeFormat(us.FirstSeen / 1000000, {format: 'YYYY-MM-DD HH:mm:ss'})}</div>
                        <div>{dateTimeFormat(us.LastSeen / 1000000, {format: 'YYYY-MM-DD HH:mm:ss'})}</div>
                        <div>{us.Count}</div>
                      </div>
                    );
                  })}
                </div>
        }
      </Collapse>
      {!isQueryInfoLoading && !isExplainLoading
        ? <Stack direction='row' justifyContent='center'>
            <Button onClick={downloadReport} size='md' fill='solid' icon='file-download' variant='secondary'>
              Download Report
            </Button>
          </Stack>
        : <></>
      }
    </Stack>
  )
}