import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { RepeatRowsOptions } from './types';
import { SortableRepeatRowsPanel } from './components/RepeatRows';

export const plugin = new PanelPlugin<RepeatRowsOptions>(SortableRepeatRowsPanel).useFieldConfig({
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
