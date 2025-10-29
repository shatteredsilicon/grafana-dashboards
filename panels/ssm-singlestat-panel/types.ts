import { ReducerID } from "@grafana/data";

export interface SingleStatOptions {
  reducer: ReducerID;
  valueFontSize: string;
  prefix: string;
  prefixFontSize: string;
  postfix: string;
  postfixFontSize: string;
  showDesc: boolean;
  descSeriesRefID: string;
  descPrefix: string;
  descPostfix: string;
  descFontSize: string;
  colors: string[];
  colorBackground: boolean;
  colorValue: boolean;
  thresholds: string;
  queryThresholds: string;
  thresholdQuery: string;
  exactThreshold: boolean;
  sparkline: {
    fillColor: string;
    full: boolean;
    lineColor: string;
    minValue: number;
    maxValue: number;
    show: boolean;
  };
};
