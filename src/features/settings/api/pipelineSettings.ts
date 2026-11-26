/**
 * Pipeline stage settings API.
 * Admin / manager can add, rename, reorder, toggle and delete pipeline stages.
 */

import { apiCall } from "@/lib/api/auth";

export type PipelineContactType = "consumer" | "partner" | "dealer";

export type PipelineStageAdmin = {
  id: number;
  name: string;
  slug: string;
  contact_type: PipelineContactType;
  description: string | null;
  order: number;
  is_active: boolean;
  locked: boolean;
  usage_count: number;
};

export const listAllPipelineStages = (
  token: string,
  contact_type?: PipelineContactType,
): Promise<PipelineStageAdmin[]> => {
  const qs = contact_type ? `?contact_type=${contact_type}` : "";
  return apiCall<PipelineStageAdmin[]>(token, "GET", `/pipeline/stages/all${qs}`);
};

export const createPipelineStage = (
  token: string,
  name: string,
  contact_type: PipelineContactType,
  description?: string,
): Promise<PipelineStageAdmin> =>
  apiCall<PipelineStageAdmin>(token, "POST", "/pipeline/stages", { name, contact_type, description });

export const updatePipelineStage = (
  token: string,
  id: number,
  patch: { name?: string; description?: string; order?: number; is_active?: boolean },
): Promise<PipelineStageAdmin> =>
  apiCall<PipelineStageAdmin>(token, "PATCH", `/pipeline/stages/${id}`, patch);

export const deletePipelineStage = (token: string, id: number): Promise<PipelineStageAdmin> =>
  apiCall<PipelineStageAdmin>(token, "DELETE", `/pipeline/stages/${id}`);

export const reorderPipelineStages = (
  token: string,
  contact_type: PipelineContactType,
  ordered_ids: number[],
): Promise<PipelineStageAdmin[]> =>
  apiCall<PipelineStageAdmin[]>(token, "POST", "/pipeline/stages/reorder", { contact_type, ordered_ids });
