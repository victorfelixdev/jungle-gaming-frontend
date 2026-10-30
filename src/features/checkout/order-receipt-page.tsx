import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useRef } from "react";
import type { Order, Wallet } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { getApiError } from "@/api/error";
import { orderQueryKey, useSession, walletsQueryKey } from "@/features/auth/session";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export function OrderReceiptPage() {
  const { orderId } = useParams({ from: "/order/$orderId" });
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const session = useSession();
  const order = useQuery({
    queryKey: orderQueryKey(session.data?.user.id, orderId),
    enabled: Boolean(session.data),
    queryFn: async () =>
      (await apiClient.get<Order>(`/orders/${orderId}`)).data,
    refetchInterval: (query) => query.state.data?.status === "pending" ? 2_000 : false,
    refetchOnWindowFocus: "always",
  });
  const wallets = useQuery({
    queryKey: walletsQueryKey(session.data?.user.id),
    enabled: Boolean(order.data),
    queryFn: async () => (await apiClient.get<Wallet[]>("/wallets")).data,
  });
  useDialogFocus(dialogRef, Boolean(order.data), () => void navigate({ to: "/", search: { page: 1, pageSize: 9, sort: "featured" } }));
  if (order.isPending)
    return (
      <main className="mx-auto max-w-[800px] px-6 py-16">
        Carregando pedido...
      </main>
    );
  if (order.isError)
    return (
      <main className="mx-auto max-w-[800px] px-6 py-16">
        <h1 className="text-xl font-bold">Não foi possível consultar o pedido.</h1>
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{getApiError(order.error).message}</p>
        <button type="button" onClick={() => void order.refetch()} className="mt-5 rounded bg-[var(--primary)] px-4 py-2 text-sm text-[var(--background)]">Tentar novamente</button>
      </main>
    );
  if (!order.data)
    return (
      <main className="mx-auto max-w-[800px] px-6 py-16">
        <h1 className="text-3xl font-bold">Pedido não encontrado</h1>
      </main>
    );
  const confirmed = order.data.status === "confirmed";
  const pending = order.data.status === "pending";
  const wallet = wallets.data?.find(({ id }) => id === order.data.walletId);
  const marketplace = {
    to: "/" as const,
    search: { page: 1, pageSize: 9, sort: "featured" as const },
  };
  return (
    <main className="min-h-dvh bg-[var(--background)]">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(10_6_4_/_75%)] p-4 md:bg-[var(--background)]">
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-title"
          className="relative max-h-[calc(100dvh-32px)] w-full max-w-[414px] overflow-y-auto border-b-[5px] border-[var(--primary)] bg-[var(--surface-card)] shadow-[0_12px_40px_rgb(0_0_0_/_40%)]"
        >
          <Link
            {...marketplace}
            aria-label="Fechar confirmação"
            className="absolute right-4 top-3 grid size-8 place-items-center text-[var(--accent)]"
          >
            <X size={18} />
          </Link>
          <header className="flex flex-col items-center border-b border-[var(--primary)] px-4 pb-4 pt-5 text-center">
            {confirmed ? <img src="/assets/figma/thank-you.svg" alt="" width="80" height="80" /> : <span aria-hidden="true" className="grid size-20 place-items-center rounded-full border border-[var(--primary)] text-3xl text-[var(--accent)]">{pending ? "…" : "×"}</span>}
            <h1
              id="receipt-title"
              aria-live="polite"
              className="mt-3 text-xs font-bold text-[var(--muted-foreground)]"
            >
              {confirmed ? "Seus NFTs agora estão na sua carteira" : pending ? "Pedido em processamento" : "Pagamento recusado"}
            </h1>
          </header>
          <dl className="grid grid-cols-2 gap-3 border-b border-[var(--primary)] px-4 py-3 text-[10px] text-[var(--muted-foreground)] md:grid-cols-4 md:gap-0 md:[&>div+div]:border-l md:[&>div+div]:border-[var(--border)] md:[&>div+div]:pl-2">
            <div className="min-w-0">
              <dt>ID da transação</dt>
              <dd className="truncate">{order.data.transactionId || (pending ? "Aguardando confirmação" : "Não gerada")}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>
                {new Date(order.data.createdAt).toLocaleDateString("pt-BR")}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{order.data.quote.total} ETH</dd>
            </div>
            <div>
              <dt>Carteira</dt>
              <dd>
                {order.data.provider ?? wallet?.label ?? "Carteira conectada"}
              </dd>
            </div>
          </dl>
          <div className="px-4 py-4">
            <h2 className="text-xs font-bold">Detalhes da transação</h2>
            <div className="mt-3 grid grid-cols-[1fr_50px_80px] border-b border-[var(--border)] pb-2 text-[11px]">
              <span>NFTs</span>
              <span>Edições</span>
              <span className="text-right">Subtotal</span>
            </div>
            <div className="mt-2 grid gap-3">
              {(order.data.lines ?? order.data.items.map((item) => ({
                ...item,
                nftName: item.nftId,
                editionName: item.editionId,
                imageUrl: "",
                subtotal: "—",
              }))).map((item) => {
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_50px_80px] items-center gap-1 text-[11px]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="size-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="size-10 shrink-0 rounded bg-[var(--surface-raised)]" />
                      )}
                      <div className="min-w-0">
                        <strong className="block truncate">
                          {item.nftName}
                        </strong>
                        <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                          {item.editionName}
                        </span>
                      </div>
                    </div>
                    <span className="text-[var(--muted-foreground)]">
                      × {item.quantity}
                    </span>
                    <strong className="text-right text-[var(--accent)]">
                      {item.subtotal}{" "}
                      ETH
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2 border-b border-[var(--border)] pb-3 text-xs">
              <div className="flex justify-between">
                <span>Taxa de rede</span>
                <span>{order.data.quote.networkFee} ETH</span>
              </div>
              {order.data.quote.discount !== "0" && (
                <div className="flex justify-between">
                  <span>Desconto</span>
                  <span>-{order.data.quote.discount} ETH</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-[var(--accent)]">
                  {order.data.quote.total} ETH
                </span>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted-foreground)]">
              {confirmed
                ? "Compra confirmada. Seus NFTs foram associados à carteira selecionada."
                : pending ? "Aguardando a confirmação da transação. Esta tela atualiza o estado automaticamente." : "A compra foi recusada. Os itens continuam no seu carrinho."}
            </p>
            {confirmed && (import.meta.env.VITE_ENABLE_MSW === "false" ? (
              <a
                href={`https://etherscan.io/tx/${order.data.transactionId}`}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer mx-auto mt-4 block w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--background)]"
              >
                Ver no Etherscan
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Transação simulada sem registro no Etherscan"
                className="cursor-pointer mx-auto mt-4 block w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--background)]"
              >
                Ver no Etherscan
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
