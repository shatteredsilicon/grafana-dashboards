import React, { useState, useEffect } from 'react';
import { DataFrame, LoadingState, PanelProps } from '@grafana/data';
import { AutoSizeInput, Table } from '@grafana/ui';
import { FilterTableOptions } from '../types';
import { cloneDeep } from "lodash";

interface Props extends PanelProps<FilterTableOptions> { }

export const FilterTablePanel: React.FC<Props> = ({ options, data, width, height }) => {
  const [inputValue, setInputValue] = useState<string>();
  const [filteredData, setFilteredData] = useState<DataFrame>({fields: [], length: 0});

  useEffect(()=>{
    if (data.state !== LoadingState.Done || data.series.length < 1) { return };

    if (options.key.length === 0 || inputValue === undefined || inputValue.length === 0) {
      setFilteredData(data.series[0]);
      return;
    }

    const fieldIndex = data.series[0].fields.findIndex(field => field.name === options.key);
    if (fieldIndex === -1) {
      return;
    }

    const d: DataFrame = {
      fields: data.series[0].fields.map(field => {
        const f = cloneDeep(field);
        f.values = [];
        return f;
      }),
      length: 0
    };
    const matches = inputValue.split(',');
    for (let i = 0; i < data.series[0].fields[fieldIndex].values.length; i++) {
      if (matches.findIndex(match => String(data.series[0].fields[fieldIndex].values[i]) === match) === -1) { continue; }

      for (let j = 0; j < data.series[0].fields.length; j++) {
        d.fields[j].values.push(data.series[0].fields[j].values[i]);
      }
    }

    d.length = d.fields.length;
    setFilteredData(d);
  }, [data, options, inputValue])

  return (
    <div style={{width: width, height: height, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'space-between'}}>
      <AutoSizeInput height={16} placeholder={`Filter by ${options.key}, split by comma`} onChange={e => setInputValue(e.currentTarget.value)} />
      <Table height={height - 16 - 8} width={width} data={filteredData}></Table>
    </div>
  );
}
