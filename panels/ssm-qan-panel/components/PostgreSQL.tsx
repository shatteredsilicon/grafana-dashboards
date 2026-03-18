import { Alert, Button, ButtonGroup, Collapse, Icon, InlineField, Input, RenderUserContentAsHTML, Stack, Text, useStyles2 } from "@grafana/ui";
import React, { useEffect, useRef, useState } from "react";
import { QueryDetails } from "../types";
import { css } from "@emotion/css";
import { TimeRange, AppEvents } from "@grafana/data";
// @ts-ignore
import appEvents from 'grafana/app/core/app_events';
import moment from "moment";
import hljs from "highlight.js";
import * as beautify from 'beautify';
import { humanize } from "panels/utils";
import { Sparkline } from "panels/Sparkline";
import { LatencyChart } from "panels/LatencyChart";
import { Instance } from "panels/useInstance";

import 'panels/hljs.scss';

// @ts-ignore
import 'renderjson';
declare const renderjson: any;

export interface PostgreSQLQueryProps {
  queryID: string;
  timeRange: TimeRange;
  instance: Instance;
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
	KeyName:      string;
  IdxScan:      number;
  IdxTupRead:   number;
  IdxTupFetch:  number;
}

interface QueryInfo {
  Type: DBObjectType;
  Create: string;
  Status: Record<string, any>;
  Index: Record<string, ShowIndexRow>;
  Errors: Array<string>;
}

interface QueryInfoResult {
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
  JSON: string;
  json: any;
  TEXT: string;
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

export const PostgreSQLQuery: React.FC<PostgreSQLQueryProps> = (props) => {
  const jsonExplainRef = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles);

  const [tables, setTables] = useState<Table[]>();
  const [views, setViews] = useState<Table[]>();
  const [procedures, setProcedures] = useState<Procedure[]>();

  const [collapseOpenState, setCollapseOpenState] = useState<{[key: string]: boolean}>(); // open by default
  const [buttonClicked, setButtonClicked] = useState<{[key: string]: boolean}>();

  const [isQueryInfoLoading, setIsQueryInfoLoading] = useState(false);
  const [isExplainLoading, setIsExplainLoading] = useState(false);

  const [queryInfo, setQueryInfo] = useState<QueryInfoResult>();
  const [queryExplain, setQueryExplain] = useState<QueryExplain>();
  const [jsonExplainError, setJSONExplainError] = useState<string>();

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
    if (queryInfo === undefined || props.queryDetails.Example === undefined || props.instance.Agent?.UUID === undefined || props.instance.UUID === undefined) return;
    
    getQueryExplain(
      props.instance.Agent.UUID,
      props.instance.UUID,
      props.queryDetails.Example.Db || '',
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

  function fetchQueryInfo(agentUUID: string, dbServerUUID: string, dbName: string | undefined, tables: Array<Table>, procedures: Array<Procedure>) {
    const url = `/qan-api/agents/${agentUUID}/cmd`;

    const data = {
      UUID: dbServerUUID,
      DB: dbName === undefined ? '' : dbName,
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
      props.queryDetails.Example?.Db,
      props.queryDetails.Query?.Tables ? props.queryDetails.Query.Tables : [],
      props.queryDetails.Query?.Procedures ? props.queryDetails.Query.Procedures : []
    )
      .then(res => res.json())
      .then(res => JSON.parse(atob(res.Data)))
      .then((res: QueryInfoResult) => {
        const tables = props.queryDetails.Query?.Tables?.filter(t => res.Info?.[`${t.Db}.${t.Table}`] && res.Info?.[`${t.Db}.${t.Table}`].Type === DBObjectType.TypeDBTable) || [];
        const views = props.queryDetails.Query?.Tables?.filter(t => res.Info?.[`${t.Db}.${t.Table}`] && res.Info?.[`${t.Db}.${t.Table}`].Type === DBObjectType.TypeDBView) || [];

        // append underlying tables/views
        Object.entries(res.Info).forEach(([key, item]) => {
          if (props.queryDetails.Query?.Tables?.some(t => `${t.Db}.${t.Table}` === key)) {
            return;
          }

          const dbTable = key.split('.');
          const db = dbTable.length > 1 ? dbTable[0] : (props.queryDetails.Example?.Db || '');
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
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, props.queryDetails.Example?.Db, newTables, [])
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
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, props.queryDetails.Example?.Db, newTables, [])
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
          fetchQueryInfo(props.instance.Agent!.UUID, props.instance.UUID, props.queryDetails.Example?.Db, [], newProcedures)
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
                        isOpen={collapseOpenState?.['text']}
                        onToggle={()=>toggleCollapse('text', true)}
                        label={
                          <div className={styles.collapseLabel}>
                            <h5>TEXT</h5>
                          </div>
                        }
                        className={styles.card}
                        collapsible
                      >
                        {isExplainLoading
                          ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
                          : !!queryExplain?.TEXT
                              ? <div className={styles.dataOutput}>
                                  <pre>{queryExplain?.TEXT}</pre>
                                  <div className='hljs-buttons'>
                                    <button className={'hljs-button' + (buttonClicked?.['TEXT explain'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('TEXT explain', queryExplain?.TEXT || '')}>Copy to clipboard</button>
                                  </div>
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
                                    <div>idx_scan</div>
                                    <div>idx_tup_read</div>
                                    <div>idx_tup_fetch</div>
                                  </div>
                                  {Object.entries(queryInfo.Info[`${tables[tableIndex].Db}.${tables[tableIndex].Table}`].Index).map(([k, index]) => {
                                    return (
                                      <div className={styles.row}>
                                        <div>{ k }</div>
                                        <div>{ index.IdxScan }</div>
                                        <div>{ index.IdxTupRead }</div>
                                        <div>{ index.IdxTupFetch }</div>
                                      </div>
                                    );
                                  })}
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
    </Stack>
  )
}