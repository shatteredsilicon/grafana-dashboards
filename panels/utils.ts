import { css } from "@emotion/css";
import { Field, FieldType, GrafanaTheme2 } from "@grafana/data";
import * as moment from 'moment';
import numeral from 'numeral';

export const GRAFANA_GRID_CELL_HEIGHT = 30;
export const GRAFANA_GRID_CELL_VMARGIN = 8;
export const GRAFANA_GRID_CELL_GAP = 8;
export const GRAFANA_GRID_COLUMN_COUNT = 24;

export function setDynamicPanelHeight(domRef: React.MutableRefObject<HTMLElement | null>) {
  const panel = domRef.current?.closest('[class$="panel-container"]') as HTMLElement;
  const h = domRef.current?.scrollHeight || 346;
  const panelHeight = h + 64;

  if (panel?.offsetHeight === panelHeight) { return; }

  if (panel) { panel!.style.height = `${panelHeight}px`; }
}

export function getValueField(fields: Field[], type?: FieldType): Field | undefined {
  return fields.find(f => f.name !== 'Time' && f.type === (type || FieldType.number));
}

export function getTimeField(fields: Field[]): Field | undefined {
  return fields.find(f => f.type === FieldType.time);
}

export function parceTime(input: number) {
  let dur = '';
  const dur_sec = moment.duration(input, 's');
  switch (true) {
    case input === 0:
      dur = '0';
      break;
    case dur_sec.as('s') > 1 && dur_sec.as('s') < 60:
      dur = dur_sec.as('s').toFixed(2) + ' sec';
      break;
    case dur_sec.as('s') >= 60:
      let secs = dur_sec.as('s');
      const secondsInDay = 24 * 60 * 60;
      if (secs >= secondsInDay) {
        const days = Math.floor(secs / secondsInDay);
        dur = `${days} days, `;
        secs = secs % secondsInDay;
      }
      dur += numeral(secs).format('00:00:00');
      break;
    case dur_sec.as('ms') < 1:
      dur = (dur_sec.as('ms') * 1000).toFixed(2) + ' \µs';
      break;
    default:
      dur = dur_sec.as('ms').toFixed(2) + ' ms';
      break;
  }
  return dur;
}

export function humanize(input: number, name: string): string {
  if (input === null) {
    return '0';
  }

  let res = '0';
  switch (true) {
    // "top 10"/profile queries no name parameters
    case name === undefined:
      res = parceTime(input);
      break;
    // time
    case name.indexOf('time') > -1:
      res = (input !== 0 && input < 0.00001) ? '<' : '';
      res += parceTime(input);
      break;
    // size
    case name.indexOf('size') > -1:
      if (input !== 0 && input < 0.01) {
        res = '<0.01 B';
      } else {
        res = numeral(input).format('0.00 b');
      }
      res = res.replace(/([\d]) B/, '$1 Bytes');
      break;
    // ops
    case name.indexOf('number') > -1:
      if (input !== 0 && input < 0.01) {
        res = '<0.01';
      } else {
        res = numeral(input).format('0.00a');
      }
      break;
    case name.indexOf('percent') > -1:
      if (input !== 0 && input < 0.0001) {
        res = '<0.01';
      } else {
        res = numeral(input).format('0.00%');
      }
      break;
    // ops
    default:
      if (input !== 0 && input < 0.01) {
        res = '<0.01';
      } else {
        res = numeral(input).format('0.00 a');
      }
      break;
  }
  return String(res).replace('<0.00', '<0.01');

}

/**
 * This translates grid height dimensions to real pixels
 */
export function translateGrafanaGridHeight(gridHeight: number): number {
  return gridHeight * (GRAFANA_GRID_CELL_HEIGHT + GRAFANA_GRID_CELL_VMARGIN) - GRAFANA_GRID_CELL_VMARGIN;
}

export const getGrafanaGridStyles = (theme: GrafanaTheme2, width: number) => {
  return {
    grid: css`
      display: grid;
      width: ${width}px;
      grid-template-columns: repeat(${GRAFANA_GRID_COLUMN_COUNT}, 1fr);
      grid-auto-rows: min-content;
      gap: ${GRAFANA_GRID_CELL_GAP}px;
    `
  };
};

export function translateGrafanaGridWidth(width: number, gridWidth: number): number {
  const unitWidth = (width - (GRAFANA_GRID_COLUMN_COUNT - 1) * GRAFANA_GRID_CELL_GAP) / GRAFANA_GRID_COLUMN_COUNT;
  return gridWidth * unitWidth + (gridWidth - 1) * GRAFANA_GRID_CELL_GAP;
}
