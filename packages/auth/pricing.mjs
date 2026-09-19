/**
 * Model pricing and quota cost calculation
 */
import { queryOne } from '../database/schema.mjs';

// Fallback pricing defaults by kind
const DEFAULT_COST_BY_KIND = {
  agent: 1,
  image: 10,
  video: 100,
};

/**
 * Calculate quota cost for a task
 * @param {Object} options
 * @param {string} [options.modelId] - Model identifier
 * @param {string} [options.kind] - Creation kind (agent, image, video)
 * @param {number} [options.count=1] - Number of items generated
 * @returns {Promise<number>} Total quota cost
 */
export async function calculateQuotaCost({ modelId, kind = 'image', count = 1 } = {}) {
  const safeCount = Math.max(1, Number.isInteger(count) ? count : 1);

  if (modelId) {
    const model = await queryOne(
      'SELECT quota_cost_per_unit, kind FROM server_models WHERE id = ?',
      [modelId]
    );

    if (model && typeof model.quota_cost_per_unit === 'number') {
      return model.quota_cost_per_unit * safeCount;
    }
  }

  const unitCost = DEFAULT_COST_BY_KIND[kind] || 1;
  return unitCost * safeCount;
}
