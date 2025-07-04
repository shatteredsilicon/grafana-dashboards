import React, { useState, useEffect } from 'react';
import { FieldSparkline, GrafanaTheme2, LoadingState, PanelProps, reduceField, ReducerID } from '@grafana/data';
import { Sparkline, useStyles2, useTheme2 } from '@grafana/ui';
import { SingleStatOptions } from '../types';
import { getTimeField, getValueField } from 'panels/utils';
import { css } from '@emotion/css';
import _ from 'lodash';

interface Props extends PanelProps<SingleStatOptions> { }

const getStyles = (theme: GrafanaTheme2, options: SingleStatOptions) => {
  return {
    wrapper: css`
      font-size: 3em;
      position: relative;
      display: flex;
      flex-direction: column-reverse;
    `,
    valueWrapper: css`
      display: flex;
      align-items: baseline;
      line-height: 1;
    `,
    prefix: css`
      font-size: ${options.prefixFontSize};
    `,
    value: css`
      font-size: ${options.valueFontSize};
    `,
    postfix: css`
      font-size: ${options.postfixFontSize};
    `,
    desc: css`
      display: flex;
      align-items: baseline;
      font-size: ${options.descFontSize};
    `,
    sparkline: css`
      position: absolute;
      left: 0;
      top: 0;
    `
  };
};

export const SingleStatPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const styles = useStyles2(getStyles, options);

  const [valueStr, setValueStr] = useState<string>('N/A');
  const [descStr, setDescStr] = useState<string>();
  const [color, setColor] = useState<string>();
  const [sparkline, setSparkline] = useState<FieldSparkline>();

  useEffect(()=>{
    if (data.state !== LoadingState.Done || !data.series) { return }


    const valueSeries = data.series.find(s => options.descSeriesRefID !== s.refId ) || data.series[0];
    const valueField = getValueField(valueSeries.fields);
    const timeField = getTimeField(valueSeries.fields);
    const value = valueField && reduceField({field: valueField, reducers: [options.reducer]})[options.reducer];
    const formattedValue = value !== undefined ? valueField && valueField.display && valueField.display(value) : undefined;

    const descSeries = data.series.find(s => options.descSeriesRefID === s.refId);
    const descField = descSeries && getValueField(descSeries?.fields);

    const queryThresholds: number[] | undefined = options.queryThresholds?.split(',').map(refID => {
      const s = data.series.find(s => s.refId === refID);
      const f = s && getValueField(s.fields);

      return f && reduceField({field: f, reducers: [ReducerID.lastNotNull]})[ReducerID.lastNotNull];
    });
    const thresholds: number[] | undefined = queryThresholds?.length && queryThresholds || options.thresholds?.split(',').map(Number);
    const thresholdSeries = options.thresholdQuery && data.series.find(s => s.refId === options.thresholdQuery);
    const thresholdField = thresholdSeries && getValueField(thresholdSeries.fields)
    const thresholdValue = thresholdField && reduceField({field: thresholdField, reducers: [ReducerID.lastNotNull]})[ReducerID.lastNotNull] || value;

    thresholdValue !== undefined && thresholds?.length && setColor(getColor(thresholds, thresholdValue, options.exactThreshold))
    formattedValue && setValueStr(`${formattedValue.text}${formattedValue.suffix !== undefined ? ' ' + formattedValue.suffix : ''}`);
    descField && descField.values.length > 0 && setDescStr(`${options.descPrefix === undefined ? '' : options.descPrefix}${descField.values[descField.values.length-1]}${options.descPostfix === undefined ? '' : options.descPostfix}`);
    valueField && timeField && setSparkline({y: valueField, x: timeField});
  }, [data, options]);

  function getColor(thresholds: number[], value: number, exactThreshold: boolean = false) {
    if (!_.isFinite(value)) {
      return undefined;
    }

    for (var i = thresholds.length; i > 0; i--) {
      if (exactThreshold ? value === thresholds[i - 1]: value >= thresholds[i - 1]) {
        return options.colors.length > i ? options.colors[i] : undefined;
      }
    }
    return _.first(options.colors);
  }

  return (
    <div className={styles.wrapper}
      style={{
        width: width, height: height,
        backgroundColor: options.colorBackground && color !== undefined ? color : ''
      }}
    >
      {sparkline &&
        <Sparkline
          width={width}
          height={options.sparkline.full ? height : (height * 0.25)}
          config={{
            min: options.sparkline.minValue,
            max: options.sparkline.maxValue,
            custom: {
              lineColor: options.sparkline.lineColor,
              fillColor: options.sparkline.fillColor
            }
          }}
          sparkline={sparkline}
          theme={useTheme2()}
        >
        </Sparkline>
      }
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'absolute',
          color: options.colorValue && color !== undefined ? color : '',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className={styles.valueWrapper}>
          <div className={styles.prefix}>{options.prefix}</div>
          <div className={styles.value}>
            {valueStr}
          </div>
          <div className={styles.postfix}>{options.postfix}</div>
        </div>
        {options.showDesc && descStr !== undefined &&
          <div className={styles.desc}>{descStr}</div>
        }
      </div>
    </div>
  );
}
