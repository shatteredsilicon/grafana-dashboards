import { FieldConfigProperty, PanelPlugin, ReducerID } from '@grafana/data';
import { SingleStatOptions } from './types';
import { SingleStatPanel } from './components/SingleStat';
import { ColorsEditor } from './components/ColorsEditor';

export const plugin = new PanelPlugin<SingleStatOptions>(SingleStatPanel).useFieldConfig({
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
}).setPanelOptions((builder, context) => {
  return builder
    .addSelect({
      path: 'reducer',
      name: 'Stat',
      category: ['Value'],
      settings: {
        options: Object.entries(ReducerID).map(([k, v]) => ({value: v, label: k}))
      },
      defaultValue: ReducerID.lastNotNull
    })
    .addTextInput({
      path: 'valueFontSize',
      name: 'Font Size',
      category: ['Value'],
      defaultValue: '80%'
    })
    .addTextInput({
      path: 'prefix',
      name: 'Prefix',
      category: ['Value']
    })
    .addTextInput({
      path: 'prefixFontSize',
      name: 'Prefix font size',
      category: ['Value'],
      defaultValue: '50%'
    })
    .addTextInput({
      path: 'postfix',
      name: 'Postfix',
      category: ['Value']
    })
    .addTextInput({
      path: 'postfixFontSize',
      name: 'Postfix font size',
      category: ['Value'],
      defaultValue: '50%'
    })
    .addBooleanSwitch({
      path: 'showDesc',
      name: 'Show description',
      category: ['Description']
    })
    .addTextInput({
      path: 'descSeriesRefID',
      name: 'Description series refId',
      description: 'Series to get description value from',
      category: ['Description'],
      settings: {
        placeholder: 'B'
      }
    })
    .addTextInput({
      path: 'descPrefix',
      name: 'Description prefix',
      category: ['Description']
    })
    .addTextInput({
      path: 'descPostfix',
      name: 'Description postfix',
      category: ['Description']
    })
    .addTextInput({
      path: 'descFontSize',
      name: 'Description font size',
      category: ['Description'],
      defaultValue: '50%'
    })
    .addBooleanSwitch({
      path: 'colorBackground',
      name: 'Background',
      category: ['Coloring']
    })
    .addBooleanSwitch({
      path: 'colorValue',
      name: 'Value',
      category: ['Coloring']
    })
    .addTextInput({
      path: 'thresholds',
      name: 'Thresholds',
      description: 'Define threshold values (separate it with comma)',
      category: ['Coloring'],
      settings: {
        placeholder: '50,80'
      }
    })
    .addTextInput({
      path: 'queryThresholds',
      name: 'Query thresholds',
      description: 'Set threshold values from these query results (separate it with comma)',
      category: ['Coloring'],
      settings: {
        placeholder: 'B,C'
      }
    })
    .addTextInput({
      path: 'thresholdQuery',
      name: 'Threshold query',
      description: 'Result from this query will be used to compare with thresholds',
      category: ['Coloring'],
      settings: {
        placeholder: 'A'
      }
    })
    .addBooleanSwitch({
      path: 'exactThreshold',
      name: 'Exact threshold',
      category: ['Coloring']
    })
    .addCustomEditor({
      id: 'colors',
      path: 'colors',
      name: 'Colors',
      category: ['Coloring'],
      editor: ColorsEditor,
      defaultValue: []
    })
    .addNestedOptions({
      path: 'sparkline',
      category: ['Spark lines'],
      build: (builder) => {
        builder
          .addBooleanSwitch({
            path: 'show',
            name: 'Show'
          })
          .addBooleanSwitch({
            path: 'full',
            name: 'Full height'
          })
          .addNumberInput({
            path: 'minValue',
            name: 'Min'
          })
          .addNumberInput({
            path: 'maxValue',
            name: 'Max'
          })
          .addColorPicker({
            path: 'lineColor',
            name: 'Line color'
          })
      }
    })
});
