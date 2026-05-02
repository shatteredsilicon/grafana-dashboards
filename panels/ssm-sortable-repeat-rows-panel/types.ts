import { DataLink, DisplayValue, DisplayValueAlignmentFactors, FieldSparkline, PanelModel as GrafanaPanelModel } from "@grafana/data";
import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode, Themeable2, VizTextDisplayOptions } from "@grafana/ui";
import { PercentChangeColorMode } from '@grafana/schema';
import { MouseEventHandler } from "react";

export interface PanelModel extends GrafanaPanelModel {
  width: number;
  height: number;
  links?: DataLink[];
}

export interface RepeatRowsOptions {
  title: string;
  header: PanelModel[];
  row: PanelModel[];
  repeat: string;
};

export interface BigValueProps extends Themeable2 {
  /** Height of the component */
  height: number;
  /** Width of the component */
  width: number;
  /** Value displayed as Big Value */
  value: DisplayValue;
  /** Sparkline values for showing a graph under/behind the value  */
  sparkline?: FieldSparkline;
  /** onClick handler for the value */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Custom styling */
  className?: string;
  /** Color mode for coloring the value or the background */
  colorMode: BigValueColorMode;
  /** Show a graph behind/under the value */
  graphMode: BigValueGraphMode;
  /** Auto justify value and text or center it */
  justifyMode?: BigValueJustifyMode;
  /** Factors that should influence the positioning of the text  */
  alignmentFactors?: DisplayValueAlignmentFactors;
  /** Explicit font size control */
  text?: VizTextDisplayOptions;
  /** Specify which text should be visible in the BigValue */
  textMode?: BigValueTextMode;
  /** If true disables the tooltip */
  hasLinks?: boolean;
  /** Percent change color mode */
  percentChangeColorMode?: PercentChangeColorMode;

  /**
   * If part of a series of stat panes, this is the total number.
   * Used by BigValueTextMode.Auto text mode.
   */
  count?: number;

  /**
   * Disable the wide layout for the BigValue
   */
  disableWideLayout?: boolean;
}
