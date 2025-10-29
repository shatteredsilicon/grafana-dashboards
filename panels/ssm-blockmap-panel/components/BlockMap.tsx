import React, { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { getValueFormat, formattedValueToString, GrafanaTheme2, LoadingState, PanelProps, FormattedValue } from '@grafana/data';
import { Text, Tooltip, useStyles2 } from '@grafana/ui';
import { BlockMapOptions } from '../types';
import { css } from '@emotion/css';
import _ from 'lodash';
import { getValueField } from 'panels/utils';

interface Props extends PanelProps<BlockMapOptions> { }

const BLOCK_SIZE = 10;
const BLOCK_GAP = 2;
const BLOCK_COLORS = ['#447EBC', '#C15C17', '#890F02', '#0A437C', '#6D1F62', '#584477', '#B7DBAB', '#F4D598', '#70DBED', '#F9BA8F', '#F29191', '#82B5D8', '#E5A8E2', '#AEA2E0', '#629E51', '#E5AC0E', '#64B0C8', '#E0752D', '#BF1B00', '#0A50A1', '#962D82', '#614D93', '#9AC48A', '#F2C96D', '#65C5DB', '#F9934E', '#EA6460', '#5195CE', '#D683CE', '#806EB7', '#3F6833', '#967302', '#2F575E', '#99440A', '#58140C', '#052B51', '#511749', '#3F2B5B', '#E0F9D7', '#FCEACA', '#CFFAFF', '#F9E2D2', '#FCE2DE', '#BADFF4', '#F9D9F9', '#DEDAF7'];
const LEGEND_HEIGHT = 24;

const getStyles = (theme: GrafanaTheme2, height: number, blockContainerWidth: number, legendContainerWidth: number) => {
  const legendContainerPadding = 8;

  return {
    blockContainer: css`
      display: flex;
      width: ${blockContainerWidth}px;
      height: ${height}px;
      flex-direction: row;
      align-items: flex-start;
      flex-wrap: wrap-reverse;
    `,
    legendContainer: css`
      display: flex;
      width: ${legendContainerWidth}px;
      height: ${height}px;
      padding-right: ${legendContainerPadding}px;
      flex-direction: column;
    `,
    legend: css`
      width: ${legendContainerWidth-legendContainerPadding}px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      height: ${LEGEND_HEIGHT}px;
      line-height: 100%;
    `,
    tooltip: css`
      z-index: 999;
      padding: 4px 8px;
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.primary};
      border-color: 1px solid ${theme.colors.secondary.border};
      box-shadow: ${theme.colors.secondary.shade} 0px 1px 2px;
      position: absolute;
    `
  };
};

interface Series {
  name: string;
  size: number;
  color?: string;
  blocks: number;
  formattedValue: FormattedValue;
}

interface Tooltip {
  left: string;
  right: string;
  top: string;
  bottom: string;
  content: ReactNode;
}

export const BlockMapPanel: React.FC<Props> = ({ data, width, height }) => {
  const blockWidthScale: number = 0.8;
  const blockContainerWidth = width * blockWidthScale;
  const legendContainerWidth = width - blockContainerWidth;
  const styles = useStyles2(getStyles, height, blockContainerWidth, legendContainerWidth);

  const [series, setSeries] = useState<Series[]>();
  const [tooltip, setTooltip] = useState<Tooltip>();

  useEffect(()=>{
    if (data.state !== LoadingState.Done) { return };

    const totalSize = data.series.reduce((a, b) => a+(_.last<number>(getValueField(b.fields)?.values) || 0), 0);
    const blockCount = _.floor(height / (BLOCK_SIZE + BLOCK_GAP)) * _.floor(blockContainerWidth / (BLOCK_GAP + BLOCK_SIZE));
    const blockSize = totalSize / blockCount;

    setSeries(data.series.map((s, index) => {
      const field = getValueField(s.fields);
      const size = _.last<number>(field?.values) || 0;

      return {
        name: s.name || (field?.name !== 'Value' && field?.name) || field?.config?.displayName || field?.config?.displayNameFromDS || s.refId || '',
        size: size,
        color: BLOCK_COLORS[index],
        blocks: blockSize ? _.ceil(size / blockSize) : 0,
        formattedValue: field?.display ? field.display(size) : (getValueFormat('short')(size))
      }
    }).sort((a, b) => b.size - a.size));
  }, [data])

  function onBlockHover(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (((height - e.nativeEvent.offsetY)%(BLOCK_SIZE+BLOCK_GAP))>BLOCK_SIZE || (blockContainerWidth%(BLOCK_SIZE+BLOCK_GAP))>BLOCK_SIZE) {
      setTooltip(undefined);
    } else {
      const blockIndex = _.floor((height - e.nativeEvent.offsetY) / (BLOCK_SIZE + BLOCK_GAP))*_.floor(blockContainerWidth/(BLOCK_SIZE+BLOCK_GAP)) + _.floor(e.nativeEvent.offsetX / (BLOCK_SIZE+BLOCK_GAP));
      const seriesIndex = series?.reduce<number[]>((acc, s, i)=>{
        if (i === 0) {
          acc.push(s.blocks);
        } else {
          acc.push(s.blocks+acc[i-1]);
        }
        return acc;
      }, []).findIndex(v=>blockIndex<=v);
      if (seriesIndex !== undefined && seriesIndex > -1) {
        setTooltip({
          left: e.nativeEvent.offsetX > (blockContainerWidth / 2) ? 'auto' : `${legendContainerWidth + e.nativeEvent.offsetX + BLOCK_SIZE/2}px`,
          right: e.nativeEvent.offsetX > (blockContainerWidth / 2) ? `${blockContainerWidth - e.nativeEvent.offsetX + BLOCK_SIZE/2}px` : 'auto',
          top: e.nativeEvent.offsetY > (height / 2) ? 'auto' : `${e.nativeEvent.offsetY + BLOCK_SIZE / 2}px`,
          bottom: e.nativeEvent.offsetY > (height / 2) ? `${height - e.nativeEvent.offsetY + BLOCK_SIZE / 2}px` : 'auto',
          content: (
            <div style={{display: 'flex', alignItems: 'center', justifyContent: e.nativeEvent.offsetX > (blockContainerWidth / 2) ? 'flex-end' : 'flex-start'}}>
              <span>{series![seriesIndex].name}</span>
              &nbsp;
              {blockNode(series![seriesIndex])}
              &nbsp;:&nbsp;
              <span>{formattedValueToString(series![seriesIndex].formattedValue)}</span>
            </div>
          )
        });
      } else {
        setTooltip(undefined);
      }
    }
  }

  function blockNode(s: Series, style?: CSSProperties): ReactNode {
    return <span style={{...style, minWidth: `${BLOCK_SIZE}px`, minHeight: `${BLOCK_SIZE}px`, width: `${BLOCK_SIZE}px`, height: `${BLOCK_SIZE}px`, backgroundColor: `${s.color}`, marginRight: `${BLOCK_GAP}px`, marginTop: `${BLOCK_GAP}px`}}></span>
  }

  return (
    <div style={{width: width, height: height, display: 'flex', position: 'relative'}}>
      <div className={styles.legendContainer}>
        {series?.map((s, i) => (
          <Tooltip content={formattedValueToString(s.formattedValue)} placement='right'>
            <div className={styles.legend}>
              <Text element='p' truncate>{s.name}</Text>
              <div style={{width: `${BLOCK_SIZE}px`, height: `${BLOCK_SIZE}px`, backgroundColor: `${s.color}`, marginLeft: `4px` }}></div>
            </div>
          </Tooltip>
        ))}
      </div>
      <div className={styles.blockContainer} onMouseMove={e=>onBlockHover(e)} onMouseLeave={()=>setTooltip(undefined)}>
        {series?.map(s => (
          Array.from(Array(s.blocks).keys()).map(()=>blockNode(s, {pointerEvents: 'none'}))
        ))}
      </div>
      {tooltip &&
        <div className={styles.tooltip} style={{left: tooltip.left, top: tooltip.top, right: tooltip.right, bottom: tooltip.bottom}}>
          {tooltip.content}
        </div>
      }
    </div>
  );
}
