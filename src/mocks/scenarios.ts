import { delay, HttpResponse } from "msw";
import { mockScenarios, type MockScenario } from "./scenario-list";
export { mockScenarios } from "./scenario-list";
export type { MockScenario } from "./scenario-list";
const storageKey = "kurio:mock-scenario";
let catalogRequests = 0;

export function resetNetworkCounters() {
  catalogRequests = 0;
}

export function getMockScenario(): MockScenario {
  const saved = localStorage.getItem(storageKey) ?? import.meta.env.VITE_MOCK_SCENARIO ?? "default";
  return mockScenarios.some(({ id }) => id === saved) ? saved as MockScenario : "default";
}

export function setMockScenario(scenario: MockScenario) {
  localStorage.setItem(storageKey, scenario);
}

export async function applyMockNetwork(request: Request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/mock/")) return;
  const scenario = getMockScenario();
  if (scenario === "offline") return HttpResponse.error();
  if (scenario === "server-error") {
    return HttpResponse.json({ code: "SERVICE_UNAVAILABLE", message: "API temporariamente indisponível." }, { status: 503 });
  }
  if (scenario === "transient-error" && url.pathname === "/api/nfts" && request.method === "GET" && catalogRequests++ === 0) {
    return HttpResponse.json({ code: "SERVICE_UNAVAILABLE", message: "Falha transitória na listagem." }, { status: 503 });
  }
  if (scenario === "slow") await delay(900);
  if (scenario === "request-timeout") await delay(11_000);
  if (scenario === "out-of-order" && url.pathname === "/api/nfts") {
    await delay(url.searchParams.get("query") === "slow" ? 900 : 40);
  }
  if (scenario === "variable-latency") {
    const seed = Array.from(url.pathname + url.search).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    await delay(100 + seed % 401);
  }
}
