import React, { useEffect, useRef, useState } from 'react';
import * as d3 from "d3";
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { humanize } from './utils';
// import { humanize } from './utils';

export interface LatencyChartData {
  [key: string]: any;
}

export interface LatencyChartProps {
  width: number;
  height: number;
  metricPrefix?: string;
  data: LatencyChartData;
  measurement: string;
}

const getStyles = (_: GrafanaTheme2, width: number, height: number) => {
  return {
    scalingSVGContainer: css`
      position: relative;
      height: ${height}px;
      width: ${width}px;
      padding: 0;

      :before {
        content: attr(data-tooltip);
        position: absolute;
        top: ${height}px;
        font-size: 0.7em;
        padding: 1px 5px;
        white-space: pre;
        display: none;
        color: black;
        background: #f0f0f0;
        box-shadow: 1px 1px 1px 1px #afafaf;
        border-radius: 1px;
        transition: opacity 0.1s ease-out;
        z-index: 99;
        text-align: left;
      }

      :hover::before {
        display: inline-block;
      }
    `,
    scalingSVG: css`
      cursor: crosshair;
      position: absolute;
      height: ${height}px;
      width: ${width}px;
      left: 0;
      top: 0;
    `,
    chartX: css`
      stroke: #aaa;
      stroke-width: 1px;
    `,
    chartLine: css`
      stroke: #D9721F;
      fill: #D9721F;
      stroke-width: 2px;
    `,
    chartMin: css`
      stroke: #D9721F;
      fill: #D9721F;
      stroke-width: 2px;
    `,
    chartMax: css`
      stroke: #D9721F;
      fill: #D9721F;
      stroke-width: 2px;
    `,
    chartAvg: css`
      fill: white;
      stroke: #D9721F;
      stroke-width: 1px;
    `,
    chartP95: css`
      fill: red;
      stroke: red;
      stroke-width: 1px;
    `
  };
};

export const LatencyChart: React.FC<LatencyChartProps> = (props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles, props.width, props.height);

  const [tooltip, setTooltip] = useState<string>();

  useEffect(() => {
    const chart = d3.select(ref.current);
    chart.selectAll('*').remove();
    const svg = chart.append('svg')
      .attr('height', props.height)
      .attr('width', props.width)
      .attr('class', styles.scalingSVG)
      .attr('viewBox', '-1 0 102 20');

    const width = Math.floor(svg.node()!.getBoundingClientRect().width);
    svg.attr('width', width).attr('viewBox', '0 0 ' + width + ' 20');

    const x = d3.scaleLog()
      .domain([0.00001, 10000])
      .range([2, width - 2])
      .clamp(true)
      .nice();

    let min = 0;
    let max = 0;
    let avg = 0;
    let p95 = 0;

    if (!!props.metricPrefix) {
      min = `${props.metricPrefix}_min` in props.data ? props.data[`${props.metricPrefix}_min`] : 0;
      max = `${props.metricPrefix}_max` in props.data ? props.data[`${props.metricPrefix}_max`] : 0;
      avg = `${props.metricPrefix}_avg` in props.data ? props.data[`${props.metricPrefix}_avg`] : 0;
      p95 = `${props.metricPrefix}_p95` in props.data ? props.data[`${props.metricPrefix}_p95`] : 0;
    } else {
      min = 'Min' in props.data ? props.data['Min'] : 0;
      max = 'Max' in props.data ? props.data['Max'] : 0;
      avg = 'Avg' in props.data ? props.data['Avg'] : 0;
      p95 = 'P95' in props.data ? props.data['P95'] : 0;
    }

    let tooltip = ` ⌜ Min: ${humanize(min, props.measurement)}\n ⌟ Max: ${humanize(max, props.measurement)}\n ◦ Avg: ${humanize(avg, props.measurement)}`;

    if (p95 !== 0 && p95 !== null ) {
      tooltip += `\n • 95%: ${humanize(p95, props.measurement)}`;
    }
    setTooltip(tooltip);

    const g = svg.append('g');

    // hrAxes
    g.append('line')
      .attr('class', styles.chartX)
      .attr('x1', '0')
      .attr('stroke-dasharray', '1, 1')
      .attr('y1', '13px')
      .attr('x2', width)
      .attr('y2', '13px');

    // hrLine
    g.append('line')
      .attr('class', styles.chartLine)
      .attr('x1', x(min) + '')
      .attr('y1', '13px')
      .attr('x2', x(max) + '')
      .attr('y2', '13px');

    // minMark
    g.append('line')
      .attr('class', styles.chartMin)
      .attr('x1', x(min) + '')
      .attr('y1', '13px')
      .attr('x2', x(min) + '')
      .attr('y2', '19px');

    // maxMark
    g.append('line')
      .attr('class', styles.chartMax)
      .attr('x1', x(max) + '')
      .attr('y1', '8px')
      .attr('x2', x(max) + '')
      .attr('y2', '13px');

    // avgMark
    g.append('circle')
      .attr('class', styles.chartAvg)
      .attr('r', 3)
      .attr('cx', x(avg) + '')
      .attr('cy', '13px');

    // p95Mark
    if (p95 > 0) {
      g.append('circle')
        .attr('class', styles.chartP95)
        .attr('r', 2)
        .attr('cx', x(p95) + '')
        .attr('cy', '13px');
    }
  }, []);

  return (
    <div ref={ref} className={styles.scalingSVGContainer} data-tooltip={tooltip}>
    </div>
  );
}