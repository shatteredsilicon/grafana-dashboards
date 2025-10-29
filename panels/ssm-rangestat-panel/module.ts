import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { RangeStatOptions } from './types';
import { RangeStatPanel } from './components/RangeStat';

export const plugin = new PanelPlugin<RangeStatOptions>(RangeStatPanel).useFieldConfig({
  standardOptions: {
    unit: {
      defaultValue: 'none'
    },
    decimals: {
      defaultValue: 0
    }
  },
  disableStandardOptions: [
    FieldConfigProperty.Min,
    FieldConfigProperty.Max,
    FieldConfigProperty.DisplayName,
    FieldConfigProperty.NoValue,
    FieldConfigProperty.Thresholds,
    FieldConfigProperty.DisplayName,
    FieldConfigProperty.Links,
    FieldConfigProperty.Color,
    FieldConfigProperty.Filterable,
  ]
});
