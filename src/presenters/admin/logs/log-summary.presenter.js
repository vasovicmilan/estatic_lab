function formatSummaryForDisplay(summary) {
  if (!summary) return null;
  return {
    date: summary.date,
    isLive: !!summary.isLive,
    generatedAt: summary.generatedAt,
    requests: summary.requests,
    logs: summary.logs,
    performance: summary.perf || null,
    topErrors: summary.topErrors || [],
    topUrls: summary.topUrls || [],
    topErrorUrls: summary.topErrorUrls || [],
  };
}

export function prepareLogDashboardData(todaySummary) {
  return {
    today: formatSummaryForDisplay(todaySummary),
    historyUrl: "/admin/logovi/istorija",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Logovi", url: null },
    ],
  };
}

export function prepareLogHistoryListData(result, query = {}) {
  return {
    items: result.data.map((s) => ({
      date: s.date,
      ukupnoZahteva: s.requests?.total ?? 0,
      greske: s.logs?.errorCount ?? 0,
      prosecnoVreme: s.perf?.avgResponseTimeMs != null ? `${s.perf.avgResponseTimeMs} ms` : "-",
      detailUrl: `/admin/logovi/istorija/${s.date}`,
    })),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/logovi/istorija",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Logovi", url: "/admin/logovi" },
      { label: "Istorija", url: null },
    ],
  };
}

export function prepareLogSummaryDetailData(summary) {
  const formatted = formatSummaryForDisplay(summary);
  return {
    summary: formatted,
    backUrl: "/admin/logovi/istorija",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Logovi", url: "/admin/logovi" },
      { label: "Istorija", url: "/admin/logovi/istorija" },
      { label: formatted?.date || "Detalji", url: null },
    ],
  };
}