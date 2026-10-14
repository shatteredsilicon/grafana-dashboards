export interface ElementProps {
  onSizeChange: ()=>void;
}

export interface ToolReport {
  ts: string;
  type: string;
  payload: string;
};