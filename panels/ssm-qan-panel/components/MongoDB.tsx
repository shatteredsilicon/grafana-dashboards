import { Alert, Collapse, Icon, Stack, Text, useStyles2 } from "@grafana/ui";
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

export interface MongoDBQueryProps {
  queryID: string;
  timeRange: TimeRange;
  instance: Instance
  queryDetails: QueryDetails;
  onSizeChange: ()=>void;
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
  JSON: string | {};
  json: any;
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

export const MongoDBQuery: React.FC<MongoDBQueryProps> = (props) => {
  const domRef = useRef<HTMLDivElement | null>(null);
  const jsonExplainRef = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles);

  const [collapseOpenState, setCollapseOpenState] = useState<{[key: string]: boolean}>(); // open by default
  const [buttonClicked, setButtonClicked] = useState<{[key: string]: boolean}>();

  const [isExplainLoading, setIsExplainLoading] = useState(false);

  const [queryExplain, setQueryExplain] = useState<QueryExplain>();
  const [jsonExplainError, setJSONExplainError] = useState<string>();

  useEffect(()=>{
    if (!queryExplain?.json || !jsonExplainRef.current) return;
    renderjson.set_icons('+', '-');
    renderjson.set_show_to_level(collapseOpenState?.['json-explain-pre'] ? 'all' : '');
    jsonExplainRef.current.innerHTML = '';
    jsonExplainRef.current.appendChild(renderjson(queryExplain.json));
  }, [queryExplain?.json, jsonExplainRef?.current, collapseOpenState?.['json'], collapseOpenState?.['json-explain-pre']]);

  useEffect(()=>{
    if (props.queryDetails.Example === undefined || props.instance.Agent?.UUID === undefined || props.instance.UUID === undefined) return;
    
    getQueryExplain(
      props.instance.Agent.UUID,
      props.instance.UUID,
      props.queryDetails.Example.Db || '',
      props.queryDetails.Example.Query,
      typeof props.queryDetails.Example.Explain === 'string' ? props.queryDetails.Example.Explain : props.queryDetails.Example.Explain.String
    );
  }, [props.queryDetails.Example, props.instance]);

  useEffect(()=>{
    props.onSizeChange();
  }, [isExplainLoading, collapseOpenState]);

  useEffect(()=>{
    if (!domRef.current) return;

    const observer = new MutationObserver(() => {
      props.onSizeChange();
    });

    observer.observe(domRef.current, {
      attributes: true, // Observe attribute changes
      childList: true,  // Observe direct child additions/removals
      subtree: true,    // Observe changes in descendants as well
      characterData: true // Observe changes to text content
    });

    return () => observer.disconnect();
  }, [domRef?.current])

  function getQueryExplain(agentUUID: string, dbServerUUID: string, dbName: string, query: string, withExplain: string) {
    const url = `/qan-api/agents/${agentUUID}/cmd`;

    const explainJSON = withExplain ? JSON.parse(withExplain) : null;
    if (explainJSON) {
      const res = explainJSON as QueryExplain;

      try {
        res.json = typeof res.JSON === 'string' ? JSON.parse(res.JSON) : res.JSON;
        setJSONExplainError(undefined);
      } catch(err: any) {
        setJSONExplainError(err.message);
      }

      setQueryExplain(res);
      return;
    }

    if (props.instance.Disconnected) {
      return;
    }

    const data = {
      UUID: dbServerUUID,
      Db: dbName,
      Query: query
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
          res.json = typeof res.JSON === 'string' ? JSON.parse(res.JSON) : res.JSON;
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

  return (
    <Stack direction='column' width='100%' gap={2} ref={domRef}>
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
              <span>
                {humanize(props.queryDetails.Metrics2?.['Query_time_sum_per_sec'], 'number')} load {humanize(props.queryDetails.Metrics2?.['Query_time_sum_of_total'], 'percent')}
              </span>
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
          {props.queryDetails.Metrics2?.['Rows_sent_sum'] !== undefined &&
            <div className={styles.metricsRow}>
              <div className={styles.cell}>Docs Returned</div>
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
                  <small>
                    <span className={styles.textPrimary}>
                      &nbsp;{humanize(props.queryDetails.Metrics2?.['Rows_sent_sum_of_total'], 'percent')} of total
                    </span>
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
              <div className={styles.cell}>Response Length</div>
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
              <div className={styles.cell}>Docs Scanned</div>
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
                <code dangerouslySetInnerHTML={{ __html: props.queryDetails.Query.Fingerprint }}></code>
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
                  <code dangerouslySetInnerHTML={{ __html: hljs.highlight(beautify.json(props.queryDetails.Example.Query), {language: 'json'}).value}}></code>
                </pre>
                <div className='hljs-buttons'>
                  <button className={'hljs-button' + (buttonClicked?.['Example'] ? ' hljs-button-clicked' : '')} onClick={()=>copyText('Example', props.queryDetails.Example?.Query || '')}>Copy to clipboard</button>
                </div>
              </div>
            </Collapse>
          }
          <>
            {props.queryDetails.Example?.Query !== undefined &&
              <>
                <Stack direction='row' justifyContent='flex-start'>
                  <Text element='h3'>EXPLAIN</Text>
                </Stack>
                <Collapse
                  isOpen={collapseOpenState?.['json'] === undefined ? true : collapseOpenState['json']}
                  onToggle={()=>toggleCollapse('json', false)}
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
          </>
        </>
      )}
    </Stack>
  )
}