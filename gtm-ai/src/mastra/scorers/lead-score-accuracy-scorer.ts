import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { LeadScoreResultSchema } from '../schemas/lead-score-result-schema';
import {appEnv} from "../config/app-env";

/**
 * Scorer that checks if the lead probability correctly matches the ground truth label.
 * Score is 1 if they match based on the threshold, 0 otherwise.
 */
export const leadScoreAccuracyScorer = createScorer({
  id: 'lead-score-accuracy',
  description: 'Checks if the lead probability correctly matches the ground truth label based on the threshold.',
  type: {
    input: z.any(),
    output: LeadScoreResultSchema,
  },
})
  .generateScore(({ run }) => {
    const { output, groundTruth } = run;
    
    // We expect groundTruth to be a boolean indicating if it IS a lead
    if (typeof groundTruth !== 'boolean') {
      return 0;
    }

    const isPredictedLead = output.leadProbability >= appEnv.LEAD_SCORE_THRESHOLD;
    return isPredictedLead === groundTruth ? 1 : 0;
  });
