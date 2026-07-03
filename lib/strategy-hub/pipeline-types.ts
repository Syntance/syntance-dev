import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";

export type PipelineStageKey = "brief" | "research" | StrategyArea;

export type PipelineStageStatus =
  | "empty"
  | "in_progress"
  | "review"
  | "ready"
  | "locked";

export interface PipelineAiAction {
  at: string;
  summary: string;
  batchId: string | null;
}

export interface PipelineHumanGate {
  label: string;
  href: string;
}

export interface PipelineStage {
  key: PipelineStageKey;
  label: string;
  status: PipelineStageStatus;
  score: number;
  aiActions: PipelineAiAction[];
  humanGates: PipelineHumanGate[];
}

export interface PipelineData {
  stages: PipelineStage[];
}
