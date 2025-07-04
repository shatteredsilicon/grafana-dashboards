import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { BlockMapOptions } from './types';
import { BlockMapPanel } from './components/BlockMap';

export const plugin = new PanelPlugin<BlockMapOptions>(BlockMapPanel).useFieldConfig({
  standardOptions: {
    unit: {
      defaultValue: 'short'
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
    FieldConfigProperty.Mappings
  ]
});
