import React, { useState, useEffect } from 'react';
import { DataFrame, FormattedValue, LoadingState, PanelProps } from '@grafana/data';
import { BigValue, BigValueJustifyMode, BigValueTextMode, useTheme2 } from '@grafana/ui';
import { RangeStatOptions } from '../types';
import { getValueField } from 'panels/utils';

interface Props extends PanelProps<RangeStatOptions> { }

export const RangeStatPanel: React.FC<Props> = ({ data, width, height }) => {
  return <RangeStat state={data.state} series={data.series} width={width} height={height} />
}

interface RangeStatProps {
  width: number;
  height: number;
  state: LoadingState;
  series: DataFrame[];
}

export const RangeStat: React.FC<RangeStatProps> = ({ state, series, width, height }) => {
  const [content, setContent] = useState<string>('N/A');

  useEffect(()=>{
    if (state !== LoadingState.Done) { return };

    const formattedValues: FormattedValue[] = [];
    for (const serie of series) {
      const field = getValueField(serie.fields);

      const formattedValue = field && field.display && field.display(field.values[field.values.length-1]);
      formattedValue && formattedValues.push(formattedValue);
    }

    if (formattedValues.length > 1 && formattedValues[0].text !== formattedValues[1].text && formattedValues[0].suffix !== formattedValues[1].suffix) {
      if (formattedValues[0].suffix && formattedValues[1].suffix && formattedValues[0].suffix === formattedValues[1].suffix) {
        setContent(`${formattedValues[0].text} - ${formattedValues[1].text}${formattedValues[1].suffix !== undefined ? ' ' + formattedValues[1].suffix : ''}`);
      } else {
        setContent(`${formattedValues[0].text}${formattedValues[0].suffix !== undefined ? ' ' + formattedValues[0].suffix : ''} - ${formattedValues[1].text}${formattedValues[1].suffix !== undefined ? ' ' + formattedValues[1].suffix : ''}`);
      }
    } else if (formattedValues.length > 0) {
      setContent(`${formattedValues[0].text}${formattedValues[0].suffix !== undefined ? ' ' + formattedValues[0].suffix : ''}`);
    }
  }, [state, series])

  return (
    <BigValue
      width={width}
      height={height}
      theme={useTheme2()}
      justifyMode={BigValueJustifyMode.Center}
      textMode={BigValueTextMode.Value}
      value={{
        text: content,
        numeric: 0
      }}
    />
  );
}
