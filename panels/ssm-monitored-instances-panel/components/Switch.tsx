import React, { forwardRef, HTMLProps, useRef } from 'react';
import { cx, css } from '@emotion/css';
import { uniqueId } from 'lodash';

import { GrafanaTheme2, deprecationWarning, ThemeRichColor } from '@grafana/data';

import { useStyles2, useTheme2 } from '@grafana/ui';
import { Icon } from '@grafana/ui';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value' | 'color'> {
  value?: boolean;
  /** Show an invalid state around the input */
  invalid?: boolean;
  color?: ThemeRichColor;
}

export const Switch = forwardRef<HTMLInputElement, Props>(
  ({ value, checked, onChange, id, label, disabled, invalid = false, color, ...inputProps }, ref) => {
  if (checked) {
    deprecationWarning('Switch', 'checked prop', 'value');
  }

  const theme = useTheme2();
  const styles = useStyles2(getSwitchStyles(color === undefined ? theme.colors.primary : color));
  const switchIdRef = useRef(id ? id : uniqueId('switch-'));

  return (
    <div className={cx(styles.switch, invalid && styles.invalid)}>
      <input
        type="checkbox"
        role="switch"
        disabled={disabled}
        checked={value}
        onChange={(event) => {
          !disabled && onChange?.(event);
        }}
        id={switchIdRef.current}
        {...inputProps}
        ref={ref}
      />
      <label htmlFor={switchIdRef.current} aria-label={label}>
        <Icon name="check" size="xs" />
      </label>
    </div>
  );
});

const getSwitchStyles = (color: ThemeRichColor) => ((theme: GrafanaTheme2, transparent?: boolean) => ({
  switch: css({
    width: '32px',
    height: '16px',
    position: 'relative',
    lineHeight: 1,

    input: {
      height: '100%',
      width: '100% !important',
      opacity: 0,
      zIndex: -1000,
      position: 'absolute',

      '&:checked + label': {
        background: color.main,
        borderColor: color.main,

        '&:hover': {
          background: color.shade,
        },

        svg: {
          transform: 'translate3d(17px, -50%, 0)',
          background: color.contrastText,
          color: color.main,
        },
      },

      '&:disabled + label': {
        background: theme.colors.action.disabledBackground,
        borderColor: theme.colors.border.weak,
        cursor: 'not-allowed',

        svg: {
          background: theme.colors.text.disabled,
        },
      },

      '&:disabled:checked + label': {
        background: color.transparent,

        svg: {
          color: color.contrastText,
        },
      },
    },

    label: {
      width: '100%',
      height: '100%',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.pill,
      background: theme.components.input.background,
      border: `1px solid ${theme.components.input.borderColor}`,
      transition: 'all 0.3s ease',

      '&:hover': {
        borderColor: theme.components.input.borderHover,
      },

      svg: {
        position: 'absolute',
        display: 'block',
        color: 'transparent',
        width: '12px',
        height: '12px',
        borderRadius: theme.shape.radius.circle,
        background: theme.colors.text.secondary,
        boxShadow: theme.shadows.z1,
        top: '50%',
        transform: 'translate3d(1px, -50%, 0)',
        transition: 'transform 0.2s cubic-bezier(0.19, 1, 0.22, 1)',

        '@media (forced-colors: active)': {
          border: `1px solid ${color.contrastText}`,
        },
      },
    },
  }),
  disabled: css({
    backgroundColor: 'rgba(204, 204, 220, 0.04)',
    color: 'rgba(204, 204, 220, 0.6)',
    border: '1px solid rgba(204, 204, 220, 0.04)',
  }),
  invalid: css({
    'input + label, input:checked + label, input:hover + label': {
      border: `1px solid ${theme.colors.error.border}`,
    },
  }),
}));