import React, { useEffect, useRef, useState } from 'react';
import { PanelProps, dateTimeFormat } from '@grafana/data';
import { QANMessage, QANOptions, QANProfile, QueryDetails } from '../types';
import { humanize, setDynamicPanelHeight } from 'panels/utils';
import { Sparkline } from 'panels/Sparkline';
import { Alert, Button, Icon, Input, RadioButtonGroup, Spinner, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useQueryParam, setQueryParam } from 'panels/useQueryParam';
import _ from 'lodash';
import { Instance, useInstance } from 'panels/useInstance';
import { css } from '@emotion/css';
import { LatencyChart } from 'panels/LatencyChart';
import { MySQLQuery } from './MySQL';
import { MongoDBQuery } from './MongoDB';
import { PostgreSQLQuery } from './PostgreSQL';
import { RefreshEvent } from '@grafana/runtime';

interface Props extends PanelProps<QANOptions> { }

const getStyles = (_: any, width: number) => {
  return {
    table: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: ${width}px;
      border-top: 1px solid #292929;
      border-left: 1px solid #292929;
    `,
    row: css`
      display: grid;
      grid-template-columns: 1fr 8fr 6fr 9fr 7fr 5fr;
      min-height: 40px;
      width: 100%;
    `,
    selectedRow: css`
      background: #234682;
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
    sortCell: css`
      cursor: pointer;
    `,
    hide: css`
      overflow: hidden;
      text-overflow: hidden;
      white-space: nowrap;
    `,
    abstract: css`
      color: #27b2e5;
      text-decoration: none;
      background-color: transparent;
    `,
    unitQPS: css`
      &:after {
        margin-left: 3px;
        content: 'QPS';
      }
    `,
    unitPercent: css`
      &:after {
        content: '%';
      }
    `
  };
};

export const QANPanel: React.FC<Props> = ({ timeRange, data, width, height, eventBus, replaceVariables }) => {
  const domRef = useRef<HTMLDivElement | null>(null);

  const styles = useStyles2(getStyles, width);

  const [queryComponent, setQueryComponent] = useState<React.ReactElement>(<></>);

  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isMoreProfileLoading, setIsMoreProfileLoading] = useState(false);
  const [isQueryDetailsLoading, setIsQueryDetailsLoading] = useState(false);

  const [profile, setProfile] = useState<QANProfile>();
  const [qanMessages, setQANMessages] = useState<QANMessage[]>();
  const [queryDetails, setQueryDetails] = useState<QueryDetails>();

  const instanceData = useInstance(replaceVariables);
  const [sourceType, setSourceType] = useState<string>(replaceVariables('$type'));
  useEffect(()=>{
    const subscriber = eventBus.getStream(RefreshEvent).subscribe(event => {
      setSourceType(replaceVariables('$type'));
    })

    return () => {
      subscriber.unsubscribe();
    }
  }, [eventBus, replaceVariables]);
  const [instances, setInstances] = useState<Instance[]>();
  useEffect(()=>{ setInstances(instanceData?.instances.filter(inst => sourceType?.toLocaleLowerCase().includes(inst.Subsystem))) }, [instanceData?.instances, sourceType])

  const oriQueryParams = useQueryParam();
  const [queryParams, setQueryParams] = useState<typeof oriQueryParams>();
  useEffect(()=>{ if (oriQueryParams === undefined) return; setQueryParams(oriQueryParams); }, [oriQueryParams])
  const [prevQueryParams, setPrevQueryParams] = useState<typeof queryParams>();
  const [search, setSearch] = useState<string>();
  useEffect(()=>{ setSearch(queryParams?.search); }, [queryParams?.search])
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>();
  const [prevTimeRange, setPrevTimeRange] = useState<typeof timeRange>();
  const [prevInstances, setPrevInstances] = useState<Instance[]>();

  const loadQueryPageSize: number = 10;

  useEffect(() => {
    setDynamicPanelHeight(domRef);
  }, [data, profile, queryDetails]);

  useEffect(() => {
    if ((_.isEqual(prevTimeRange, timeRange) && _.isEqual(_.omit(queryParams, 'queryID'), _.omit(prevQueryParams, 'queryID')) && _.isEqual(prevInstances, instances)) || !instances?.length) { return; }

    loadQueries(true);
    setPrevQueryParams(queryParams);
    setPrevTimeRange(timeRange);
    setPrevInstances(instances);
    if (queryParams?.hosts !== prevQueryParams?.hosts) {
      instances?.forEach(instance => {
        instance.Agent && getQANMessage(instance.Agent?.UUID, instance.UUID);
      })
    }
  }, [queryParams, instances, timeRange]);

  useEffect(() => {
      queryParams?.queryID === undefined || !profile?.Query ? setSelectedRowIdx(undefined) : setSelectedRowIdx(profile.Query.findIndex(q=>q.Id === queryParams.queryID));
  }, [queryParams?.queryID, profile?.Query])

  function getQANMessage(agentUUID: string, instanceUUID: string) {
    fetch(`/qan-api/agents/${agentUUID}/cmd`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AgentUUID: agentUUID,
        Service: 'qan',
        Cmd: 'GetMessages',
        Data: btoa(instanceUUID)
      })
    })
      .then(res => res.json())
      .then(res => {
        if (res.Error) { throw new Error(res.Error); }
        return JSON.parse(atob(res['Data']));
      })
      .then((res: QANMessage[]) => {
        setQANMessages(res);
      })
  }

  function loadQueries(reset: boolean = false) {
    if (reset) { setIsProfileLoading(true); } else { setIsMoreProfileLoading(true); }
    reset && setProfile(undefined);

    const search = isSearchQuery() ? queryParams!.search! : '';
    const firstSeen = queryParams?.firstSeen;

    const searchValue = btoa(
      search.replace(/%([0-9A-F]{2})/g,
        (match, p1) => String.fromCharCode(Number('0x' + p1)))
    );
    fetch(`/qan-api/qan/profile?begin=${timeRange.from.toISOString().replace(/Z$/, '')}&end=${timeRange.to.toISOString().replace(/Z$/, '')}&offset=${reset || profile === undefined || profile.Query === null ? 0 : (profile.Query.length - 1)}&first_seen=${String(!!firstSeen)}&search=${searchValue}${queryParams?.sortBy ? `&sort_by=${queryParams?.sortBy}` : ''}&${instances?.map(instance => `uuids[]=${instance.UUID}`).join('&')}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then((p: QANProfile) => {
        if (!reset && profile !== undefined && profile.Query) { profile.Query.shift(); p.Query?.splice(1, 0, ...profile.Query); }
        setProfile(p);
      })
      .finally(() => {
        if (reset) { setIsProfileLoading(false); } else { setIsMoreProfileLoading(false); }
      })
  }

  function loadMoreQueries() {
    loadQueries();
  }

  function setFirstSeen(v: boolean) {
    setQueryParam({ 'first_seen': String(v) });
    setQueryParams(queryParams === undefined ? undefined : { ...queryParams, firstSeen: v });
  }

  function searchQuery() {
    search !== undefined && setQueryParam({ 'search': search });
    setQueryParams(queryParams === undefined ? undefined : { ...queryParams, search: search });
  }

  function setQueryID(v: string) {
    setQueryParam({ 'queryID': v });
    setQueryParams(queryParams === undefined ? undefined : { ...queryParams, queryID: v });
  }

  function setSortBy(v?: string) {
    v !== undefined && setQueryParam({ 'sort_by': v });
    setQueryParams(queryParams === undefined ? undefined : { ...queryParams, sortBy: v });
  }

  function isSearchQuery() {
    return queryParams?.search !== undefined && queryParams.search !== 'null';
  }

  useEffect(()=>{
    if (!queryParams?.queryID || !profile?.Query || profile.Query.findIndex(q => q.Id === queryParams.queryID) === -1) { setQueryDetails(undefined); return; }
    if (!instances?.length) return;

    setIsQueryDetailsLoading(true);
    setQueryComponent(<></>);
    const uri = queryParams.queryID === 'TOTAL' ? '/qan-api/qan/server-summary/report' : `/qan-api/qan/query/${queryParams.queryID}/report`;
    fetch(`${uri}?begin=${timeRange.from.toISOString().replace(/Z$/, '')}&end=${timeRange.to.toISOString().replace(/Z$/, '')}&${instances?.map(instance => `uuids[]=${instance.UUID}`).join('&')}`)
      .then(res => res.json())
      .then((d: QueryDetails) => {
        setQueryDetails(d);
        queryParams.queryID && d && instances?.length > 0 && setQueryComponent(
          sourceType === 'MySQL'
            ? <MySQLQuery queryID={queryParams.queryID} timeRange={timeRange} instances={instances} instance={instances[0]} queryDetails={d} onSizeChange={()=>setDynamicPanelHeight(domRef)} />
            : sourceType === 'MongoDB' && instances
              ? <MongoDBQuery queryID={queryParams.queryID} timeRange={timeRange} instance={instances[0]} queryDetails={d} onSizeChange={()=>setDynamicPanelHeight(domRef)} />
              : sourceType === 'PostgreSQL'
                ? <PostgreSQLQuery queryID={queryParams.queryID} timeRange={timeRange} instance={instances[0]} queryDetails={d} onSizeChange={()=>setDynamicPanelHeight(domRef)} />
                : <></>
        )
      })
      .catch(()=>{
        setQueryDetails(undefined);
      })
      .finally(() => {
        setIsQueryDetailsLoading(false);
      })
  }, [queryParams?.queryID, profile?.Query])

  return (
    <div ref={domRef} style={{ width: width, height: height, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {isProfileLoading
        ? <Icon name='spinner' size='xxxl' />
        : <Stack direction='column' width='100%' gap={2}>
            {qanMessages?.map(m => (
              <Alert title=''>{m.Content}</Alert>
            ))}
            <div style={{ maxWidth: width, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text element='h5'>Top {profile?.Query?.length && profile?.Query?.length - 1 || 0} of {profile?.TotalQueries || 0} Queries by % Grand Total Time (%GTT)</Text>
              <Stack direction='row' alignItems='center'>
                <Text element='p'>Display</Text>
                <RadioButtonGroup
                  value={queryParams?.firstSeen || false}
                  options={[{ label: 'All queries', value: false }, { label: 'First seen', value: true }]}
                  onChange={v => { setFirstSeen(v); }}
                />
              </Stack>
              <div style={{ maxWidth: '370px', width: '30%' }}>
                <form onSubmit={e => { e.preventDefault(); searchQuery(); }}>
                  <Input value={search} addonAfter={<Button icon='search' variant='secondary' onClick={()=>searchQuery()} />} placeholder='Search by query abstract, fingerprint or ID' onChange={e => setSearch(e.currentTarget.value)} />
                </form>
              </div>
            </div>
            <div className={styles.table}>
              <div className={styles.row}>
                <div className={styles.cell}>#</div>
                <div className={styles.cell}>Query Abstract</div>
                <div className={`${styles.cell} ${styles.sortCell}`} onClick={()=>{ queryParams?.sortBy === 'load' ? setSortBy(undefined) : setSortBy('load') }}>
                  <Stack direction='row' justifyContent='space-between' width='100%'>
                    <span>Load</span>
                    {queryParams?.sortBy === 'load' && <span><Icon name='arrow-down' /></span>}
                  </Stack>
                </div>
                <div className={`${styles.cell} ${styles.sortCell}`} onClick={()=>{ queryParams?.sortBy === 'count' ? setSortBy(undefined) : setSortBy('count') }}>
                  <Stack direction='row' justifyContent='space-between' width='100%'>
                    <span>Count</span>
                    {queryParams?.sortBy === 'count' && <span><Icon name='arrow-down' /></span>}
                  </Stack>
                </div>
                <div className={`${styles.cell} ${styles.sortCell}`} onClick={()=>{ queryParams?.sortBy === 'latency' ? setSortBy(undefined) : setSortBy('latency') }}>
                  <Stack direction='row' justifyContent='space-between' width='100%'>
                    <span>Latency</span>
                    {queryParams?.sortBy === 'latency' && <span><Icon name='arrow-down' /></span>}
                  </Stack>
                </div>
                <div className={`${styles.cell} ${styles.sortCell}`} onClick={()=>{ queryParams?.sortBy === 'first_seen' ? setSortBy(undefined) : setSortBy('first_seen') }}>
                  <Stack direction='row' justifyContent='space-between' width='100%'>
                    <span>First Seen</span>
                    {queryParams?.sortBy === 'first_seen' && <span><Icon name='arrow-down' /></span>}
                  </Stack>
                </div>
              </div>
              {profile?.Query?.length && profile.Query.length > 1 &&
                profile?.Query?.map((q, i) => {
                  return (
                    <div className={styles.row + (selectedRowIdx === i ? ` ${styles.selectedRow}` : ' ')} onClick={() => { setSelectedRowIdx(i); setQueryID(i === 0 ? 'TOTAL' : q.Id); }}>
                      <div className={styles.cell}>{i || ''}</div>
                      <div className={`${styles.cell} ${styles.hide}`}>
                        <Text element='span' truncate>
                          <a className={styles.abstract} title={q.Fingerprint}>
                            {q.Rank ? (q.Abstract || 'Low Ranking Queries') : 'TOTAL'}
                          </a>
                        </Text>
                      </div>
                      <div className={styles.cell}>
                        <Stack direction='row' justifyContent='space-between' width='100%'>
                          <Sparkline
                            width={100}
                            height={20}
                            xkey="Start_ts"
                            ykey="Query_load"
                            measurement="number"
                            data={q.Log}
                          />
                          <span>{humanize(q.Load, 'number')}</span>
                          <span>{humanize(q.Percentage, 'percent')}</span>
                        </Stack>
                      </div>
                      <div className={styles.cell}>
                        <Stack direction='row' justifyContent='space-between' width='100%'>
                          <span className={styles.unitQPS}>{humanize(q.QPS, 'number')}</span>
                          <Sparkline
                            width={100}
                            height={20}
                            xkey="Start_ts"
                            ykey="Query_count"
                            measurement="number"
                            data={q.Log}
                          />
                          <span>{humanize(q.Stats.Cnt, 'number')}</span>
                          <span className={styles.unitPercent}>{profile?.Query?.length ? (q.Stats.Cnt / profile?.Query[0].Stats.Cnt * 100).toFixed(2) : 0}</span>
                        </Stack>
                      </div>
                      <div className={styles.cell}>
                        <Stack direction='row' justifyContent='space-between' width='100%'>
                          <Sparkline
                            width={100}
                            height={20}
                            xkey="Start_ts"
                            ykey="Query_time_avg"
                            measurement="time"
                            data={q.Log}
                          />
                          <span>{humanize(q.Stats.Avg, 'number')}</span>
                          <LatencyChart
                            width={100}
                            height={20}
                            measurement='time'
                            data={q.Stats}
                          />
                        </Stack>
                      </div>
                      <div className={styles.cell}>{q.Rank ? dateTimeFormat(q.FirstSeen, {format: 'YYYY-MM-DD HH:mm:ss'}) : ''}</div>
                    </div>
                  );
                })
              }
            </div>
            {(!profile?.Query?.length || profile.Query.length === 1) &&
              <Stack width='100%' direction='row' justifyContent='center'>
                <Stack maxWidth='80%' grow={0}>
                  {isSearchQuery()
                    ? <Alert title='' severity='warning'>There are no queries during the selected time range, try widening your time range.</Alert>
                    : queryParams?.firstSeen
                      ? <Alert title='' severity='warning'>There are no queries First Seen during the selected time range, try widening your time range.</Alert>
                      : sourceType === 'MySQL'
                        ? <Alert title='' severity='warning'>
                            There is no query data because the MySQL Server is not configured for monitoring. For details about the
                            required configuration, see <TextLink href="https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/conf-mysql.md" external>
                              Configuring MySQL for Shattered Silicon Monitoring
                            </TextLink> in SSM documentation.
                          </Alert>
                        : sourceType === 'MongoDB'
                          ? <Alert title='' severity='warning'>
                              There is no query data because profiling is not enabled for the selected host. For information about how to
                              enable profiling, see <TextLink href="https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/conf-mongodb.md" external>
                                Configuring profiling in MongoDB
                              </TextLink> in SSM documentation.
                            </Alert>
                          : sourceType === 'PostgreSQL'
                            ? <Alert title='' severity='warning'>
                                There is no query data because the PostgreSQL Server is not configured for monitoring. For details about the
                                required configuration, see <TextLink href="https://github.com/shatteredsilicon/ssm-doc/blob/1.x/docs/conf-postgres.md" external>
                                  Configuring PostgreSQL for Shattered Silicon Monitoring
                                </TextLink> in SSM documentation.
                              </Alert>
                            : <Alert title='' severity='warning'>No data. Please check ssm-client and database configurations on selected instance.</Alert>
                  }
                </Stack>
              </Stack>
            }
            {profile?.TotalQueries !== undefined && profile.TotalQueries > 0 && profile?.Query && !isProfileLoading &&
              <div style={{ width: '100%', maxWidth: width, display: 'flex', flexDirection: 'row', justifyContent: 'center' }} >
                {(()=>{
                  const leftInDbQueries = profile?.TotalQueries - (profile?.Query.length - 1);
                  return (
                    <Button variant='secondary' size='md' disabled={isMoreProfileLoading || leftInDbQueries <= 0} onClick={()=>loadMoreQueries()}>
                      {isMoreProfileLoading
                        ? <Spinner />
                        : leftInDbQueries > 0
                          ? `Load next ${leftInDbQueries > loadQueryPageSize ? loadQueryPageSize : leftInDbQueries} queries`
                          : 'No more queries for selected time range'
                      }
                    </Button>
                  );
                })()}
              </div>
            }
          </Stack>
      }
      {!!queryParams?.queryID &&
        <div style={{width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {isQueryDetailsLoading
            ? <Stack direction='row' justifyContent='center' width='100%'><Icon name='spinner' size='xxxl' /></Stack>
            : queryDetails !== undefined && queryDetails.Metrics2 !== undefined
              ? queryComponent
              : <></>
          }
        </div>
      }
    </div>
  );
}
