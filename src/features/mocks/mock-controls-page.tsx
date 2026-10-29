import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { getApiError } from "@/api/error";
import { mockScenarios, type MockScenario } from "@/mocks/scenario-list";

export function MockControlsPage() {
  const [scenario, setScenario] = useState<MockScenario>("default");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiClient.get<{ current: MockScenario }>("/mock/scenario")
      .then(({ data }) => setScenario(data.current))
      .catch((reason) => setError(getApiError(reason).message));
  }, []);

  const update = async (next: MockScenario, reset = false) => {
    setPending(true);
    setError("");
    try {
      if (reset) await apiClient.post("/mock/reset");
      else await apiClient.put("/mock/scenario", { scenario: next });
      window.location.reload();
    } catch (reason) {
      setError(getApiError(reason).message);
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Cenários de demonstração</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        Escolher um cenário restaura os dados iniciais e encerra a sessão. O reset restaura o cenário selecionado.
      </p>
      <div className="mt-8 grid gap-3">
        {mockScenarios.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending}
            onClick={() => void update(option.id)}
            aria-pressed={scenario === option.id}
            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface-card)] p-4 text-left focus-visible:outline-2 focus-visible:outline-[var(--ring)] aria-pressed:border-[var(--primary)]"
          >
            <span className="block font-bold">{option.label}</span>
            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{option.description}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-5 text-[var(--danger)]">{error}</p>}
      <div className="mt-8 flex gap-3">
        <Button disabled={pending} onClick={() => void update(scenario, true)}>Resetar dados</Button>
        <Button asChild variant="outline"><Link to="/" search={{ page: 1, pageSize: 9, sort: "featured" }}>Voltar à loja</Link></Button>
      </div>
    </main>
  );
}
