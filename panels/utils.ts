import { Field, FieldType } from "@grafana/data";

export function setDynamicPanelHeight(domRef: React.MutableRefObject<HTMLElement | null>) {
  const panel = domRef.current?.closest('[class$="panel-container"]') as HTMLElement;
  const h = domRef.current?.scrollHeight || 346;
  const panelHeight = h + 64;

  if (panel?.offsetHeight === panelHeight) { return; }

  if (panel) { panel!.style.height = `${panelHeight}px`; }
}

export function getValueField(fields: Field[], type?: FieldType): Field | undefined {
  return fields.find(f => f.name !== 'Time' && f.type === (type || FieldType.number));
}

export function getTimeField(fields: Field[]): Field | undefined {
  return fields.find(f => f.type === FieldType.time);
}
