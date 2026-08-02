import type { ReactNode } from "react";

export type IconRenderer = (
  iconKey: string | undefined,
  label: string,
) => ReactNode;

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  accessor?: keyof Row;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  width?: string;
  render?: (row: Row, rowIndex: number) => ReactNode;
  sortValue?: (row: Row) => string | number;
}

export interface DataTableSummaryCell {
  id: string;
  align?: "left" | "center" | "right";
  content: ReactNode;
  empty?: boolean;
}
