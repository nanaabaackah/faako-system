import type { DomainValue, IsoDateTimeString } from "./domain";

export type AnalyticsApplicationId = string;
export type AnalyticsTenantId = string;
export type AnalyticsConfidence = "low" | "medium" | "high" | "not_applicable";
export type AnalyticsDataQualityStatus = "good" | "warning" | "blocked";
export type AnalyticsDataQualityCheckStatus = "pass" | "warning" | "fail";

export interface AnalyticsContext {
  applicationId: AnalyticsApplicationId;
  tenantId: AnalyticsTenantId;
}

export interface AnalyticsCalculationPeriod {
  startAt: IsoDateTimeString;
  endAt: IsoDateTimeString;
}

export interface AnalyticsDataQualityCheck {
  checkId: string;
  status: AnalyticsDataQualityCheckStatus;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  affectedRecords: number;
}

export interface AnalyticsDataQualityResult {
  status: AnalyticsDataQualityStatus;
  checks: AnalyticsDataQualityCheck[];
  warnings: string[];
}

export interface AnalyticsRequest<Data extends Record<string, DomainValue> = Record<string, DomainValue>> {
  context: AnalyticsContext;
  period: AnalyticsCalculationPeriod;
  sourceTimestamp: IsoDateTimeString;
  data: Data;
}

export interface AnalyticsResponse<Result extends Record<string, DomainValue> = Record<string, DomainValue>> {
  analysisId: string;
  metricIds: string[];
  calculationVersion: string;
  context: AnalyticsContext;
  period: AnalyticsCalculationPeriod;
  sourceTimestamp: IsoDateTimeString;
  refreshTimestamp: IsoDateTimeString;
  requestId: string;
  result: Result;
  confidence: AnalyticsConfidence;
  warnings: string[];
  dataQuality: AnalyticsDataQualityResult;
}

export interface TimeSeriesPoint {
  timestamp: IsoDateTimeString;
  value: number | null;
  dimensions?: Record<string, string | number | boolean | null>;
}

export interface KpiResult {
  metricId: string;
  value: number | null;
  unit: string;
  change?: number | null;
  changeUnit?: "absolute" | "percentage_points" | "percent";
}

export interface ForecastResult {
  metricId: string;
  horizonStart: IsoDateTimeString;
  horizonEnd: IsoDateTimeString;
  baselineMethod: string;
  forecast: TimeSeriesPoint[];
  lowerBound?: TimeSeriesPoint[];
  upperBound?: TimeSeriesPoint[];
  evaluationMetric?: string | null;
  evaluationValue?: number | null;
}

export interface AnomalyResult {
  metricId: string;
  timestamp: IsoDateTimeString;
  observedValue: number;
  expectedValue?: number | null;
  severity: "low" | "medium" | "high" | "critical";
  explanation?: string | null;
}

export interface SegmentResult {
  segmentId: string;
  label: string;
  size: number;
  metrics: KpiResult[];
}

export interface AnalyticsRecommendation {
  recommendationId: string;
  title: string;
  rationale: string;
  priority: "low" | "medium" | "high";
  evidenceMetricIds: string[];
  actionPath?: string | null;
}

export interface AnalyticsDataset<Row extends Record<string, DomainValue> = Record<string, DomainValue>> {
  datasetId: string;
  grain: string;
  rows: Row[];
}

