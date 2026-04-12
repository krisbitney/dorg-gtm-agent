import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { LeadAnalysisResultSchema } from '../schemas/lead-analysis-result-schema';

/**
 * Scorer that checks if a lead analysis result is complete.
 * If isLead is true, it must have non-empty whyFit and needs.
 * If isLead is false, it's considered complete.
 */
export const leadAnalysisCompletenessScorer = createScorer({
  id: 'lead-analysis-completeness',
  description: 'Checks if a lead analysis result has all mandatory fields when isLead is true.',
  type: {
    input: z.any(),
    output: LeadAnalysisResultSchema,
  },
})
  .generateScore(({ run }) => {
    const { output } = run;
    
    if (!output.isLead) {
      return 1;
    }
    
    // If it is a lead, check for meaningful content in mandatory fields
    const hasWhyFit = !!output.whyFit && output.whyFit.trim().length > 10;
    const hasNeeds = !!output.needs && output.needs.trim().length > 5;
    
    return hasWhyFit && hasNeeds ? 1 : 0;
  });
