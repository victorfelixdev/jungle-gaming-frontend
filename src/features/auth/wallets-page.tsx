import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { User, Wallet } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { getApiError } from "@/api/error";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { ProfileSidebar } from "./profile-sidebar";
import { useSession, walletsQueryKey } from "./session";

const fieldClass = "min-h-9 rounded-sm bg-transparent text-sm";
const selectClass = "min-h-9 w-full rounded-sm border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--muted-foreground)] outline-none focus-visible:border-[var(--accent)]";

export function WalletsPage() {
  const session = useSession();
  const [newPrimary, setNewPrimary] = useState(false);
  const [showSecondaryForm, setShowSecondaryForm] = useState<boolean | string>(false);
  const [sameAsPrimary, setSameAsPrimary] = useState(false);
  const wallets = useQuery({
    queryKey: walletsQueryKey(session.data?.user.id),
    queryFn: async () => (await apiClient.get<Wallet[]>("/wallets")).data,
    enabled: Boolean(session.data),
  });

  if (!session.data) return null;

  const primary = wallets.data?.find((wallet) => wallet.isPrimary);
  const secondary = wallets.data?.filter((wallet) => !wallet.isPrimary) ?? [];

  return (
    <main className="mx-auto grid min-h-dvh max-w-[1200px] gap-6 px-5 pb-36 pt-7 md:grid-cols-[265px_minmax(0,1fr)] md:px-6 md:pb-16 lg:px-0">
      <ProfileSidebar active="wallets" />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Carteira principal</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
            </p>
          </div>
          <button type="button" onClick={() => setNewPrimary(true)} className="cursor-pointer shrink-0 text-sm text-[var(--accent)] hover:underline">
            Adicionar
          </button>
        </div>

        {wallets.isLoading ? (
          <p className="mt-7 text-sm text-[var(--muted-foreground)]">Carregando carteiras...</p>
        ) : wallets.isError ? (
          <p role="alert" className="mt-7 text-sm text-[var(--accent)]">Não foi possível carregar as carteiras.</p>
        ) : (
          <WalletForm
            key={newPrimary ? "new-primary" : primary?.id ?? "empty-primary"}
            wallet={newPrimary ? undefined : primary}
            user={session.data.user}
            isPrimary
            onSaved={() => setNewPrimary(false)}
          />
        )}

        <section className="mt-7 border-t border-[var(--border)] pt-5 md:border-0 md:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Carteira secundária</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {secondary.length ? `${secondary.length} carteira${secondary.length > 1 ? "s" : ""} adicionada${secondary.length > 1 ? "s" : ""}.` : "Você ainda não adicionou uma carteira secundária."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  onChange={(event) => {
                    setSameAsPrimary(event.target.checked);
                    if (event.target.checked) setShowSecondaryForm(false);
                  }}
                  className="accent-[var(--primary)]"
                />
                Igual à carteira principal
              </label>
              <button type="button" onClick={() => { setSameAsPrimary(false); setShowSecondaryForm(true); }} className="text-sm text-[var(--accent)] hover:underline">
                Adicionar
              </button>
            </div>
          </div>
          {secondary.length > 0 && !sameAsPrimary && (
            <ul className="mt-4 grid gap-2">
              {secondary.map((wallet) => (
                <li key={wallet.id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--border)] px-3 py-2 text-sm">
                  <span><strong>{wallet.label}</strong> <span className="text-[var(--muted-foreground)]">· {wallet.network} · {wallet.address}</span></span>
                  <button type="button" onClick={() => setShowSecondaryForm(wallet.id === showSecondaryForm ? false : wallet.id)} className="cursor-pointer text-[var(--accent)] hover:underline">Editar</button>
                </li>
              ))}
            </ul>
          )}
          {showSecondaryForm && !sameAsPrimary && (
            <WalletForm
              key={typeof showSecondaryForm === "string" ? showSecondaryForm : "new-secondary"}
              wallet={typeof showSecondaryForm === "string" ? secondary.find(({ id }) => id === showSecondaryForm) : undefined}
              user={session.data.user}
              isPrimary={false}
              onSaved={() => setShowSecondaryForm(false)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function WalletForm({ wallet, user, isPrimary, onSaved }: { wallet?: Wallet; user: User; isPrimary: boolean; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(wallet?.displayName ?? user.name);
  const [label, setLabel] = useState(wallet?.label ?? "");
  const [network, setNetwork] = useState<Wallet["network"] | "">(wallet?.network ?? "");
  const [profileName, setProfileName] = useState(wallet?.profileName ?? user.username ?? "");
  const [address, setAddress] = useState(wallet?.address ?? "");
  const [secondaryEns, setSecondaryEns] = useState(wallet?.secondaryEns ?? "");
  const [walletType, setWalletType] = useState(wallet?.walletType ?? "");
  const [referralCode, setReferralCode] = useState(wallet?.referralCode ?? "");
  const [email, setEmail] = useState(wallet?.email ?? user.email);
  const [ensName, setEnsName] = useState(wallet?.ensName?.replace(/\.(eth|crypto)$/, "") ?? user.ensName?.replace(/\.(eth|crypto)$/, "") ?? "");
  const [ensSuffix, setEnsSuffix] = useState(wallet?.ensName?.endsWith(".crypto") ? ".crypto" : ".eth");
  const [feedback, setFeedback] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const details: Omit<Wallet, "id"> = {
        label: label.trim(),
        address: address.trim(),
        network: network as Wallet["network"],
        isPrimary,
        displayName: displayName.trim(),
        profileName: profileName.trim(),
        secondaryEns: secondaryEns.trim(),
        walletType,
        referralCode: referralCode.trim(),
        email: email.trim(),
        ensName: `${ensName.trim()}${ensSuffix}`,
      };
      return wallet
        ? (await apiClient.patch<Wallet>(`/wallets/${wallet.id}`, details)).data
        : (await apiClient.post<Wallet>("/wallets", details)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setFeedback("Carteira salva com sucesso.");
      onSaved();
    },
    onError: (error) => setFeedback(getApiError(error).message),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="mt-7">
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span>Nome de exibição <Required /></span>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span>Apelido da carteira <Required /></span>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span>Rede <Required /></span>
          <select value={network} onChange={(event) => setNetwork(event.target.value as Wallet["network"] | "")} required className={selectClass}>
            <option value="">Selecione uma rede</option>
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span>Nome do perfil <Required /></span>
          <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span>Endereço da carteira <Required /></span>
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Endereço 0x da carteira" required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span aria-hidden="true" className="invisible hidden md:block">Endereço da carteira</span>
          <Input aria-label="ENS ou carteira secundária" value={secondaryEns} onChange={(event) => setSecondaryEns(event.target.value)} placeholder="ENS ou carteira secundária (opcional)" className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span>Tipo de carteira <Required /></span>
          <select value={walletType} onChange={(event) => setWalletType(event.target.value)} required className={selectClass}>
            <option value="">Selecione uma carteira</option>
            <option value="MetaMask">MetaMask</option>
            <option value="WalletConnect">WalletConnect</option>
            <option value="Coinbase Wallet">Coinbase Wallet</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span>Código de indicação <Required /></span>
          <Input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span>E-mail <Required /></span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className={fieldClass} />
        </label>
        <div className="grid gap-2 text-sm">
          <label htmlFor={`${isPrimary ? "primary" : "secondary"}-ens`}>Nome ENS <Required /></label>
          <div className="flex gap-2">
            <DropdownSelect
              value={ensSuffix}
              onChange={setEnsSuffix}
              options={[{ label: ".eth", value: ".eth" }, { label: ".crypto", value: ".crypto" }]}
              ariaLabel="Sufixo ENS"
              triggerClassName="min-h-9 min-w-[90px] rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
            />
            <Input id={`${isPrimary ? "primary" : "secondary"}-ens`} value={ensName} onChange={(event) => setEnsName(event.target.value)} required className={`${fieldClass} min-w-0`} />
          </div>
        </div>
      </div>
      {feedback && <p role="status" className="mt-3 text-sm text-[var(--accent)]">{feedback}</p>}
      <Button type="submit" disabled={save.isPending} className="cursor-pointer mt-7 min-h-9 rounded-sm px-2 text-[11px]">
        {save.isPending ? "Salvando..." : isPrimary ? "Salvar carteira" : "Salvar carteira secundária"}
      </Button>
    </form>
  );
}

function Required() {
  return <span className="text-[var(--accent)]">*</span>;
}
