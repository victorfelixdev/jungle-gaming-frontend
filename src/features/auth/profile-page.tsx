import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { Session, User } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { getApiError } from "@/api/error";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { ProfileSidebar } from "./profile-sidebar";
import { sessionQueryKey, useSession } from "./session";

export function ProfilePage() {
  const session = useSession();
  if (!session.data) return null;

  return (
    <main className="mx-auto grid min-h-dvh max-w-[1200px] gap-6 px-5 pb-36 pt-7 md:grid-cols-[265px_minmax(0,1fr)] md:px-6 md:pb-16 lg:px-0">
      <ProfileSidebar active="profile" />
      <ProfileEditor key={session.data.user.id} user={session.data.user} />
    </main>
  );
}

function ProfileEditor({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [ensName, setEnsName] = useState(user.ensName?.replace(/\.(eth|crypto)$/, "") ?? "");
  const [ensSuffix, setEnsSuffix] = useState(user.ensName?.endsWith(".crypto") ? ".crypto" : ".eth");
  const [walletNickname, setWalletNickname] = useState(user.walletNickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");

  const save = useMutation({
    mutationFn: async () =>
      (
        await apiClient.patch<Session>("/profile", {
          name,
          username,
          email,
          ensName: ensName.trim() ? `${ensName.trim()}${ensSuffix}` : "",
          walletNickname,
          avatarUrl,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(sessionQueryKey, updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback("Perfil salvo com sucesso.");
    },
    onError: (error) => setFeedback(getApiError(error).message),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setFeedback("Preencha os três campos para alterar a senha.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback("A confirmação da nova senha não coincide.");
        return;
      }
    }
    save.mutate();
  };

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_000_000) {
      setFeedback("Escolha uma imagem de até 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
      setFeedback("");
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={submit} className="min-w-0">
      <h2 className="text-base font-bold">Perfil do colecionador</h2>
      <div className="mt-7 grid gap-x-6 gap-y-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span>Nome de exibição <span className="text-[var(--accent)]">*</span></span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required className="min-h-9 rounded-sm bg-transparent text-sm" />
        </label>
        <label className="grid gap-2 text-sm">
          <span>Nome de usuário <span className="text-[var(--accent)]">*</span></span>
          <Input value={username} onChange={(event) => setUsername(event.target.value)} required className="min-h-9 rounded-sm bg-transparent text-sm" />
        </label>
        <label className="grid gap-2 text-sm">
          <span>E-mail <span className="text-[var(--accent)]">*</span></span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="min-h-9 rounded-sm bg-transparent text-sm" />
        </label>
        <div className="grid gap-2 text-sm">
          <label htmlFor="profile-ens">Nome ENS <span className="text-[var(--accent)]">*</span></label>
          <span className="flex gap-2">
            <DropdownSelect
              value={ensSuffix}
              onChange={setEnsSuffix}
              options={[{ label: ".eth", value: ".eth" }, { label: ".crypto", value: ".crypto" }]}
              ariaLabel="Sufixo ENS"
              triggerClassName="min-h-9 min-w-[90px] rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
            />
            <Input id="profile-ens" value={ensName} onChange={(event) => setEnsName(event.target.value)} required className="min-h-9 min-w-0 rounded-sm bg-transparent text-sm" />
          </span>
        </div>
        <label className="grid gap-2 text-sm">
          <span>Apelido da carteira <span className="text-[var(--accent)]">*</span></span>
          <Input value={walletNickname} onChange={(event) => setWalletNickname(event.target.value)} required className="min-h-9 rounded-sm bg-transparent text-sm" />
        </label>
        <div className="grid gap-2 text-sm">
          <span>Avatar</span>
          <div className="flex items-center gap-3">
            <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-card)] text-[var(--accent)]">
              <ImageIcon size={18} />
              {avatarUrl && <img src={avatarUrl} alt="Avatar atual" className="absolute inset-0 size-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />}
            </span>
            <input ref={fileInput} type="file" accept="image/*" className="sr-only" aria-label="Escolher avatar" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
            <Button type="button" onClick={() => fileInput.current?.click()} className="min-h-9 px-5 text-xs">Alterar</Button>
            <button type="button" onClick={() => setAvatarUrl(null)} className="text-xs hover:text-[var(--accent)]">Remover</button>
          </div>
        </div>
      </div>
      <section className="mt-7 max-w-[440px]">
        <h3 className="text-base font-bold">Alterar senha</h3>
        <div className="mt-4 grid gap-5">
          <PasswordField label="Senha atual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        </div>
      </section>
      {feedback && <p role="status" className="mt-4 text-sm text-[var(--accent)]">{feedback}</p>}
      <Button type="submit" disabled={save.isPending} className="mt-7 min-h-9 min-w-28 rounded-sm text-xs">
        {save.isPending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-2 text-sm">
      <span>{label}</span>
      <span className="relative">
        <Input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="min-h-9 rounded-sm bg-transparent pr-10 text-sm" />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--accent)]">
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </span>
    </label>
  );
}
