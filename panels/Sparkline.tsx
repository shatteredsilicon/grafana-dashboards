import React, { useEffect, useRef, useState } from 'react';
import * as d3 from "d3";
import * as moment from 'moment';
import { css } from '@emotion/css';
import { DateTime, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { humanize } from './utils';
// import { humanize } from './utils';

export interface SparklineData {
  [key: string]: any;
}

export interface SparklineProps {
  width: number;
  height: number;
  xkey: string;
  ykey: string;
  data: SparklineData[];
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
    line: css`
      fill: none;
      stroke: #D9721F;
      stroke-width: 1px;
    `,
    area: css`
      fill: #D9721F;
      stroke: none;
      opacity: 0.1;
    `,
    xAxis: css`
      fill: none;
      stroke: #D9721F;
      stroke-width: 1px;
      stroke-opacity: 0.1;
    `,
    circle: css`
      fill: white;
      stroke: #D9721F;
      stroke-width: 1px;
    `,
    focusLine: css`
      fill: none;
      stroke: #D9721F;
      stroke-width: 0.5px;
    `,
    focusCircle: css`
      fill: #D9721F;
    `,
    overlay: css`
      fill: none;
      stroke: none;
      pointer-events: all;
    `
  };
};

export const Sparkline: React.FC<SparklineProps> = (props) => {
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
      .attr('preserveAspectRatio', 'none')
      .attr('viewBox', '-1 0 102 20');

    const height = 15;
    const width = Math.floor(svg.node()!.getBoundingClientRect().width);
    svg.attr('width', width).attr('viewBox', '-1 0 ' + (width + 2) + ' 20');

    const xDomain = d3.extent(props.data.map(d => moment.utc(d[props.xkey])));

    const xScale = d3.scaleTime().range([2, width - 2]).domain(xDomain as [DateTime, DateTime]);

    const yDomain = d3.extent(props.data.map(d => props.ykey in d ? d[props.ykey] : 0));

    const yScale = d3.scaleLinear().range([height, 2]).domain(yDomain as [DateTime, DateTime]).clamp(true);

    const svgLine = d3.line<SparklineData>()
      .defined(d => !d['NoData'] as boolean)
      .x(d => xScale(moment.utc(d[props.xkey])))
      .y(d => yScale(d[props.ykey] === undefined ? 0 : d[props.ykey]));

    const svgArea = d3.area<SparklineData>()
      .defined(d => !d['NoData'])
      .x(d => xScale(moment.utc(d[props.xkey])))
      .y0(d => yScale(d[props.ykey] === undefined ? 0 : d[props.ykey]))
      .y1(height - 1);

    const g = svg.append('g').attr('transform', 'translate(0, 0)');

    g.append('path')
      .datum(props.data)
      .attr('class', styles.area)
      .attr('d', svgArea);

    g.append('path')
      .datum(props.data)
      .attr('class', styles.line)
      .attr('d', svgLine);

    g.append('line')
      .attr('x1', width + 20)
      .attr('y1', height)
      .attr('x2', '0')
      .attr('y2', height)
      .attr('class', styles.xAxis);

    const focus = g.append('g').style('display', 'none');

    focus.append('line')
      .attr('id', 'focusLineX')
      .attr('class', styles.focusLine);

    focus.append('circle')
      .attr('id', 'focusCircle')
      .attr('r', 1.5)
      .attr('class', `${styles.circle} ${styles.focusCircle}`);

    focus.append('text')
      .attr('id', 'focusText')
      .attr('font-size', '10')
      .attr('x', 1)
      .attr('y', 8);

    // @ts-ignore TS2345
    const bisectDate = d3.bisector((d, x) => moment.utc(d[props.xkey]).isBefore(x)).right;

    const rect = g.append('rect')
      .attr('class', styles.overlay)
      .attr('width', width)
      .attr('height', height)
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => focus.style('display', 'none'));

    rect.on('mousemove', (event) => {
      const mouseDate: any = moment.utc(xScale.invert(event.offsetX));
      // returns the index to the current data item
      const i = Math.min(Math.max(bisectDate(props.data, mouseDate), 0), props.data.length - 1);
      let d = props.data[i];

      // correction bisector to use data[0] on right edge of sparkline.
      if (i === 1) {
        const d0 = moment.utc(props.data[0][props.xkey]);
        const d1 = moment.utc(props.data[1][props.xkey]);
        if (mouseDate.diff(d1) > 0 && d0.diff(mouseDate) < mouseDate.diff(d1)) {
          d = props.data[0];
        }
      }

      const x = xScale(d3.isoParse(d[props.xkey]) as Date);
      const y = yScale(d[props.ykey] === undefined ? 0 : d[props.ykey]);

      const MIN = 0,
        MAX = 1;
      focus.select('#focusCircle')
        .attr('cx', x)
        .attr('cy', y);
      focus.select('#focusLineX')
        .attr('x1', x).attr('y1', yScale(yDomain[MIN]))
        .attr('x2', x).attr('y2', yScale(yDomain[MAX]));

      const value = d[props.ykey] === undefined ? 0 : d[props.ykey];
      const load = humanize(value, props.measurement);

      const dateToShow = moment.utc(d[props.xkey]).toLocaleString();
      setTooltip(d['NoData'] ? `No data at ${dateToShow}` : `${load} at ${dateToShow}`);
    });
  }, []);

  return (
    <div ref={ref} className={styles.scalingSVGContainer} data-tooltip={tooltip}>
    </div>
  );
}