import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { Options } from './types';
import { TextPanel } from './components/Text';

export const plugin = new PanelPlugin<Options>(TextPanel).useFieldConfig({
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
