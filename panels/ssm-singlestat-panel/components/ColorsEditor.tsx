import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { SingleStatOptions } from '../types';
import { Button, ColorPickerInput, Stack } from '@grafana/ui';

type ColorsEditorProps = StandardEditorProps<string[], unknown, SingleStatOptions, {}>;

const DEFAULT_COLORS = [
  "rgb(24, 27, 31)",
  "rgba(36, 112, 33, 0.97)",
  "rgba(237, 129, 40, 0.89)",
  "rgba(161, 18, 18, 0.9)"
];

export const ColorsEditor = ({ value: colors, onChange }: ColorsEditorProps) => {
  function onColorChange(cs: string[]) {
    onChange(cs);
  }

  return (
    <Stack direction='column' width='100%'>
      {colors?.map((color, index) => (
        <ColorPickerInput value={color} color={color} onChange={v => { colors[index] = v; onColorChange(colors) }}/>
      ))}
      <Button variant='secondary' icon='plus' size='sm' onClick={() => { colors.length >= DEFAULT_COLORS.length ? colors.push('#000000') : colors.push(DEFAULT_COLORS[colors.length]); onColorChange(colors) }} fullWidth>Add color</Button>
    </Stack>
  );
};
