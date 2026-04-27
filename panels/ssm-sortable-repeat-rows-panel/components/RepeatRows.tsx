import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BigValueGraphMode, SortOrder, TimeZone } from '@grafana/schema';
import { DataQueryResponse, PanelProps, DataFrame, ReducerID, LoadingState, TimeRange, applyFieldOverrides, InterpolateFunction, getFieldDisplayValues } from '@grafana/data';
import { BigValueProps, RepeatRowsOptions, PanelModel } from '../types';
import { getDataSourceSrv } from '@grafana/runtime';
import { Observable } from 'rxjs';
import { BigValue, CollapsableSection, DataLinksContextMenu, Dropdown, Icon, IconButton, Menu, PanelChrome, SingleStatBaseOptions, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { translateGrafanaGridWidth, translateGrafanaGridHeight, getGrafanaGridStyles, GRAFANA_GRID_CELL_VMARGIN } from 'panels/utils';
import { RangeStat } from 'panels/ssm-rangestat-panel/components/RangeStat';

interface Props extends PanelProps<RepeatRowsOptions> { }

const SortableRepeatRow: React.FC<{
  title: string;
  panels: PanelModel[];
  width: number;
  timeRange: TimeRange;
  timeZone?: TimeZone;
  hoverHeader?: boolean;
  replaceVariables: InterpolateFunction;
  onSizeChanged?: () => void;
  isHeaderRow?: boolean;
  onSortColumn?: (index: number) => void;
  sortIndex?: number;
  sortOrder?: SortOrder;
  onValuesFetched?: (rowVar: string, values: any[]) => void;
}> = (props) => {
  const theme = useTheme2();
  const styles = useStyles2(getGrafanaGridStyles, props.width);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [data, setData] = useState<DataQueryResponse[]>(Array.from<DataQueryResponse>({ length: props.panels.length ?? 0 }));
  const [hoverIdx, setHoverIdx] = useState<number>();

  function updateData() {
    props.panels.forEach((panel, i) => {
      getDataSourceSrv().get(panel.datasource)
        .then(api => {
          const targets = (panel.targets ? [...panel.targets] : []).map(t => {
            const target = { ...t };
            if ('expr' in target && !props.isHeaderRow) {
              target.expr = props.replaceVariables(target.expr as string, { "host": { value: props.title } });
            }
            return target;
          });
          const resp = api.query({
            targets: targets,
            range: props.timeRange,
          } as any);
          if (resp instanceof Promise) {
            resp.then(res => {
              res.data = applyFieldOverrides({
                data: res.data as DataFrame[],
                fieldConfig: panel.fieldConfig ?? {},
                theme: theme,
                replaceVariables: props.replaceVariables,
              });
              setData(rowData => [...rowData.slice(0, i), res, ...rowData.slice(i+1)]);
            });
          } else if (resp instanceof Observable) {
            resp.subscribe(res => {
              res.data = applyFieldOverrides({
                data: res.data as DataFrame[],
                fieldConfig: panel.fieldConfig ?? {},
                theme: theme,
                replaceVariables: props.replaceVariables,
              });
              setData(rowData => [...rowData.slice(0, i), res, ...rowData.slice(i+1)]);
            });
          }
        });
    });
  }

  useEffect(()=>{
    updateData();
  }, [props.panels, props.timeRange])

  // Extract and report values whenever data changes to enable parent sorting
  useEffect(() => {
    if (props.onValuesFetched && props.title && !props.isHeaderRow) {
      const vals: any[] = [];
      data.forEach((d, panelIdx) => {
        const panel = props.panels[panelIdx];
        let val = null;
        
        if (panel.type === "stat" && d?.data && d.data.length > 0) {
          const opts = panel.options as (BigValueProps & SingleStatBaseOptions);
          const displayValues = getFieldDisplayValues({
            reduceOptions: opts.reduceOptions ?? [ReducerID.last],
            fieldConfig: panel.fieldConfig ?? {},
            replaceVariables: props.replaceVariables,
            theme: theme,
            data: d.data as DataFrame[],
            timeZone: props.timeZone
          });
          
          if (displayValues?.length > 0) {
            val = displayValues[displayValues.length - 1].display.numeric;
          }
        }
        vals[panelIdx] = val;
      });
      props.onValuesFetched(props.title, vals);
    }
  }, [data, props.panels, props.title, theme, props.replaceVariables, props.timeZone, props.onValuesFetched, props.isHeaderRow]);

  useLayoutEffect(()=>{
    props.onSizeChanged && props.onSizeChanged();
  }, [isCollapsed])

  return (
    <CollapsableSection label={<Text color='primary'>{props.title}</Text>} isOpen={!isCollapsed} onToggle={isOpen => setIsCollapsed(!isOpen)}>
      <div className={styles.grid}>
        {props.panels.map((panel, panelIdx) => {
          const children = (innerWidth: number, innerHeight: number) => {
            switch (panel.type) {
            case "stat":
              const opts = panel.options as (BigValueProps & SingleStatBaseOptions);

              const displayValues = getFieldDisplayValues({
                reduceOptions: opts.reduceOptions ?? [ReducerID.last],
                fieldConfig: panel.fieldConfig,
                replaceVariables: props.replaceVariables,
                theme: theme,
                data: data[panelIdx]?.data,
                sparkline: true,
                timeZone: props.timeZone
              })

              const bigValueProps = {
                ...opts,
                theme: theme,
                value: displayValues?.length > 0 ? displayValues[displayValues.length-1].display : undefined,
                sparkline: opts.graphMode !== BigValueGraphMode.None && displayValues?.length > 0 ? displayValues[displayValues.length-1].sparkline : undefined,
                height: innerHeight,
                width: innerWidth,
              };

              return (
                !props.isHeaderRow && displayValues?.length > 0 && displayValues[displayValues.length - 1].hasLinks && displayValues[displayValues.length - 1].getLinks
                  ? <DataLinksContextMenu links={displayValues[displayValues.length - 1].getLinks!}>
                      {(api)=>{
                        const { openMenu, targetClassName } = api;
                        bigValueProps['onClick'] = openMenu;
                        bigValueProps['className'] = targetClassName;
                        return (
                          <BigValue
                            {...bigValueProps}
                          />
                        );
                      }}
                    </DataLinksContextMenu>
                  : <BigValue
                      {...bigValueProps}
                    />
              )
            case "ssm-rangestat-panel":
              return <RangeStat
                state={data[panelIdx]?.state ?? LoadingState.NotStarted}
                series={data[panelIdx]?.data}
                width={innerWidth}
                height={innerHeight}
              />
            default:
              return <></>
            }
          };

          // Handle header sort icon & links
          const sortIcon = props.isHeaderRow && props.sortIndex === panelIdx && props.sortOrder !== SortOrder.None ? (
            <PanelChrome.TitleItem>
              <Icon name={props.sortOrder === SortOrder.Ascending ? 'arrow-up' : 'arrow-down'} size="lg" />
            </PanelChrome.TitleItem>
          ) : null;

          const linkItems = (panelIdx === hoverIdx || !props.hoverHeader) && panel.links?.length
            ? panel.links.length > 1
              ? <Dropdown
                  overlay={
                    <Menu>
                      {panel.links.map((link, idx) => (
                        <Menu.Item key={idx} label={link.title} target={link.targetBlank && '_blank' || undefined} url={link.url} />
                      ))}
                    </Menu>
                  }
                >
                  <IconButton variant='secondary' name='external-link-alt' size='md' aria-label='' />
                </Dropdown>
              : <PanelChrome.TitleItem href={panel.links[0].url} target={panel.links[0].targetBlank && '_blank' || undefined} title={panel.links[0].title}>
                  <Icon name="external-link-alt" size="md" />
                </PanelChrome.TitleItem>
            : undefined;

          return (
            <div 
              key={panelIdx}
              onMouseEnter={e => props.hoverHeader && setHoverIdx(panelIdx) && e.stopPropagation()} 
              onMouseLeave={() => props.hoverHeader && setHoverIdx(undefined)} 
              onClick={() => props.isHeaderRow && props.onSortColumn && props.onSortColumn(panelIdx)}
              style={{
                gridColumn: `span ${panel.width}`, 
                cursor: props.isHeaderRow ? 'pointer' : 'default' 
              }}
            >
              <PanelChrome
                title={panel.title}
                padding='none'
                hoverHeader={props.hoverHeader}
                hoverHeaderOffset={0}
                width={translateGrafanaGridWidth(props.width, panel.width)}
                height={translateGrafanaGridHeight(panel.height)}
                children={children}
                titleItems={
                  (sortIcon || linkItems) ? (
                    <>
                      {sortIcon}
                      {linkItems}
                    </>
                  ) : undefined
                }
              />
            </div>
          )
        })}
      </div>
    </CollapsableSection>
  );
}

export const SortableRepeatRowsPanel: React.FC<Props> = ({ options, width, timeRange, timeZone, replaceVariables }) => {
  const domRef = useRef<HTMLDivElement | null>(null);

  const [repeatVars, setRepeatVars] = useState<string[]>([]);
  const [sortIndex, setSortIndex] = useState<number | undefined>();
  const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.None);
  const [rowValues, setRowValues] = useState<Record<string, any[]>>({});

  useEffect(()=>{
    const rawRepeatVars = replaceVariables(`\$${options.repeat}`, undefined, 'json');
    setRepeatVars(JSON.parse(rawRepeatVars.startsWith('[') ? rawRepeatVars : (rawRepeatVars.startsWith('"') ? `[${rawRepeatVars}]` : `["${rawRepeatVars}"]`)));
  }, [options.repeat, replaceVariables(`\$${options.repeat}`)])

  const handleValuesFetched = useCallback((rowVar: string, values: any[]) => {
    setRowValues((prev) => {
      const prevVals = prev[rowVar];
      if (!prevVals || prevVals.length !== values.length) {
        return { ...prev, [rowVar]: values };
      }
      // Check if values actually changed to prevent infinite rerenders
      let changed = false;
      for (let i = 0; i < values.length; i++) {
        if (prevVals[i] !== values[i]) {
          changed = true;
          break;
        }
      }
      return changed ? { ...prev, [rowVar]: values } : prev;
    });
  }, []);

  const handleSortColumn = (index: number) => {
    if (sortIndex === index) {
      if (sortOrder === SortOrder.Descending) setSortOrder(SortOrder.Ascending);
      else if (sortOrder === SortOrder.Ascending) setSortOrder(SortOrder.None);
      else setSortOrder(SortOrder.Descending);
    } else {
      setSortIndex(index);
      setSortOrder(SortOrder.Descending);
    }
  };

  const sortedRepeatVars = useMemo(() => {
    if (sortIndex === undefined || sortOrder === SortOrder.None) {
      return repeatVars;
    }
    return [...repeatVars].sort((a, b) => {
      const valA = rowValues[a]?.[sortIndex];
      const valB = rowValues[b]?.[sortIndex];

      if (valA == null && valB == null) return 0;
      if (valA == null) return sortOrder === SortOrder.Ascending ? 1 : -1;
      if (valB == null) return sortOrder === SortOrder.Ascending ? -1 : 1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === SortOrder.Ascending ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortOrder === SortOrder.Ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [repeatVars, rowValues, sortIndex, sortOrder]);

  function updatePanelHeight() {
    const panel = domRef.current?.closest('[class$="panel-transparent-container"]') as HTMLElement;
    const h = domRef.current?.scrollHeight || 100;
    const panelHeight = h + 2 * GRAFANA_GRID_CELL_VMARGIN;

    if (panel?.offsetHeight === panelHeight) { return; }

    if (panel) { panel!.style.height = `${panelHeight}px`; }
  }

  return (
    <div ref={domRef} style={{ width: width, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      <SortableRepeatRow
        replaceVariables={replaceVariables}
        title={options.title}
        panels={options.header}
        width={width}
        timeRange={timeRange}
        timeZone={timeZone}
        onSizeChanged={updatePanelHeight}
        isHeaderRow={true}
        onSortColumn={handleSortColumn}
        sortIndex={sortIndex}
        sortOrder={sortOrder}
      />
      {sortedRepeatVars.map(repeatVar => (
        <SortableRepeatRow
          key={repeatVar}
          replaceVariables={replaceVariables}
          title={repeatVar}
          panels={options.row}
          width={width}
          timeRange={timeRange}
          timeZone={timeZone}
          hoverHeader={true}
          onSizeChanged={updatePanelHeight}
          onValuesFetched={handleValuesFetched}
        />
      ))}
    </div>
  );
}