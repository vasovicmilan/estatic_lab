export function buildPaginatedResult(data = [], overrides = {}) {
  return {
    data,
    total: data.length,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  };
}

export default { buildPaginatedResult };