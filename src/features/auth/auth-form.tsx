import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import type { Credentials, RegisterInput } from "@/api/contracts";
import { getApiError } from "@/api/error";
import { clearPrivateCache, signIn, signUp, sessionQueryKey } from "./session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearGuestCart, getGuestCart } from "@/features/cart/local-cart";
import { apiClient } from "@/api/client";
import { useDialogFocus } from "@/lib/use-dialog-focus";

const mobileFieldClass = "min-h-11 rounded-[9px] bg-transparent text-xs font-normal placeholder:text-[var(--muted-foreground)] md:min-h-10 md:rounded-md md:bg-[var(--surface)] md:text-sm";

export function AuthForm({
  mode,
  redirect,
  modal = false,
  onClose,
  onComplete,
  onModeChange,
}: {
  mode: "login" | "register";
  redirect?: string;
  modal?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  onModeChange?: (mode: "login" | "register") => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isLogin = mode === "login";
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, modal, () => onClose?.());
  const mutation = useMutation({
    mutationFn: (input: Credentials | RegisterInput) =>
      isLogin ? signIn(input) : signUp(input as RegisterInput),
    onSuccess: async (session) => {
      clearPrivateCache(queryClient);
      queryClient.setQueryData(sessionQueryKey, session);
      await Promise.all(
        getGuestCart().map((item) => apiClient.post("/cart/items", item)),
      );
      clearGuestCart();
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      if (modal) onComplete?.();
      else void navigate({ to: redirect?.startsWith("/") ? redirect : "/" });
    },
    onError: (reason) => setError(getApiError(reason).message),
  });

  const content = (
    <section
      ref={dialogRef}
      role={modal ? "dialog" : undefined}
      aria-modal={modal || undefined}
      aria-label={modal ? (isLogin ? "Entrar" : "Criar conta") : undefined}
      className={
        modal
          ? "relative w-full max-w-[445px] border-b-[6px] border-[var(--primary)] bg-[var(--surface-card)] px-[70px] pb-[84px] pt-[38px] shadow-[0_20px_60px_rgb(0_0_0_/_35%)]"
          : `flex min-h-dvh w-full max-w-[420px] flex-col rounded-[36px] bg-[var(--background)] px-6 pt-[clamp(72px,15vh,122px)] md:block md:min-h-0 md:rounded-none md:border md:border-[var(--border)] md:bg-[var(--surface-card)] md:p-10 ${isLogin ? "pb-14" : "pb-0"}`
      }
    >
      {modal && (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-3 top-2 grid size-7 place-items-center text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      )}
      {!modal && (
        <Link to="/" search={{ page: 1, pageSize: 9, sort: "featured" }} className="text-center text-[28px] font-bold tracking-[0.12em] md:hidden">
          KURIO
        </Link>
      )}
      <div
        className={
          modal
            ? "auth-modal-tabs flex justify-center gap-2 text-lg"
            : "hidden gap-6 border-b border-[var(--border)] pb-4 text-sm md:flex"
        }
      >
        {modal ? (
          <>
            <button
              type="button"
              onClick={() => {
                setError(undefined);
                setShowPassword(false);
                onModeChange?.("login");
              }}
              className={
                isLogin ? "cursor-pointer font-bold text-[var(--primary)]" : "font-bold"
              }
            >
              Entrar
            </button>
            <span aria-hidden="true" className="text-[var(--primary)]">
              |
            </span>
            <button
              type="button"
              onClick={() => {
                setError(undefined);
                setShowPassword(false);
                onModeChange?.("register");
              }}
              className={
                !isLogin ? "cursor-pointer font-bold text-[var(--primary)]" : "font-bold"
              }
            >
              Criar conta
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              search={{ redirect }}
              className={
                isLogin
                  ? "font-bold text-[var(--accent)] cursor-pointer"
                  : "text-[var(--muted-foreground)]"
              }
            >
              Entrar
            </Link>
            <Link
              to="/register"
              search={{ redirect }}
              className={
                !isLogin
                  ? "font-bold text-[var(--accent)] cursor-pointer"
                  : "text-[var(--muted-foreground)]"
              }
            >
              Criar conta
            </Link>
          </>
        )}
      </div>
      {!modal && (
        <h1 className="mt-[clamp(54px,10vh,82px)] text-center text-lg font-bold md:mt-8 md:text-left md:text-3xl">
          <span className="md:hidden">{isLogin ? "Entrar" : "Criar perfil de colecionador"}</span>
          <span className="hidden md:inline">{isLogin ? "Bem-vindo de volta" : "Crie sua conta"}</span>
        </h1>
      )}
      <p
        className={
          modal
            ? "-mx-7 mt-8 text-center text-[11px] leading-4"
            : "mt-3 hidden text-sm leading-6 text-[var(--muted-foreground)] md:block"
        }
      >
        {modal
          ? isLogin
            ? "Entre para gerenciar sua carteira, coleção e perfil de criador."
            : "Crie seu perfil de colecionador e conecte uma carteira quando quiser."
          : isLogin
            ? "Entre para favoritar NFTs e finalizar suas compras."
            : "Colecione e acompanhe seus NFTs em um só lugar."}
      </p>
      <form
        key={mode}
        className={modal ? "mt-5 grid gap-2" : "mt-7 grid gap-3 md:mt-8 md:gap-4"}
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const data = new FormData(event.currentTarget);
          const email = String(data.get("email") ?? "");
          const password = String(data.get("password") ?? "");
          if (
            !email ||
            !password ||
            (!isLogin && !String(data.get("name") ?? ""))
          ) {
            setError("Preencha os campos obrigatórios.");
            return;
          }
          if (!isLogin && password.length < 8) {
            setError("Use ao menos 8 caracteres na senha.");
            return;
          }
          if (
            !isLogin &&
            password !== String(data.get("confirmPassword") ?? "")
          ) {
            setError("As senhas não coincidem.");
            return;
          }
          mutation.mutate(
            isLogin
              ? { email, password }
              : { name: String(data.get("name")), email, password },
          );
        }}
      >
        {!isLogin && (
          <label className={modal ? "text-xs" : "grid gap-2 text-sm font-bold"}>
            <span className={modal ? "sr-only" : "sr-only md:not-sr-only"}>Nome de usuário</span>
            <Input
              name="name"
              autoComplete="username"
              placeholder="Nome de usuário"
              required
              className={
                modal ? "min-h-9 rounded-sm bg-transparent text-xs" : `${mobileFieldClass} text-center md:text-left`
              }
            />
          </label>
        )}
        <label className={modal ? "text-xs" : "grid gap-2 text-sm font-bold"}>
          <span className={modal ? "sr-only" : "sr-only md:not-sr-only"}>E-mail</span>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder={isLogin ? "contato@email.com" : "Digite seu e-mail"}
            required
            className={modal ? "min-h-9 rounded-sm bg-transparent text-xs" : mobileFieldClass}
          />
        </label>
        <div
          className={
            modal ? "relative text-xs" : "grid gap-2 text-sm font-bold"
          }
        >
          <label htmlFor="auth-password" className={modal ? "sr-only" : "sr-only md:not-sr-only"}>
            Senha
          </label>
          <span className="relative block">
            <Input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              placeholder={isLogin ? "************" : "Senha"}
              className={
                modal
                  ? "min-h-9 rounded-sm border-[var(--primary)] bg-transparent pr-10 text-xs"
                  : `${mobileFieldClass} border-[var(--primary)] pr-10`
              }
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-[var(--primary)] ${modal ? "" : "md:hidden"}`}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </span>
        </div>
        {!isLogin && (
          <label className={modal ? "text-xs" : "grid gap-2 text-sm font-bold"}>
            <span className={modal ? "sr-only" : "sr-only md:not-sr-only"}>Confirmar senha</span>
            <span className="relative block">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirmar senha"
                required
                className={
                  modal ? "min-h-9 rounded-sm bg-transparent pr-10 text-xs" : `${mobileFieldClass} pr-10`
                }
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-[var(--primary)] ${modal ? "" : "md:hidden"}`}
                aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
              >
                {showConfirmPassword ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </span>
          </label>
        )}
        {isLogin && (
          <button
            type="button"
            disabled
            className={modal ? "auth-modal-forgot mb-1 text-right text-[var(--primary)]" : "mb-1 text-right text-xs text-[var(--primary)] md:hidden"}
          >
            Esqueceu a senha?
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending}
          className={modal ? "auth-modal-submit cursor-pointer mt-2 min-h-10 rounded-sm" : "mt-4 min-h-[54px] rounded-[9px] text-sm text-[var(--background)] md:mt-0 md:min-h-10 md:rounded-md md:text-[var(--accent-foreground)]"}
        >
          {mutation.isPending
            ? "Aguarde..."
            : isLogin
              ? "Entrar"
              : modal ? "Criar conta" : "Criar perfil"}
        </Button>
      </form>
      <div className={modal ? "mt-5 grid gap-3 text-center text-[10px]" : "mt-10 grid gap-3 text-center text-[11px] md:hidden"}>
          <div className="flex items-center gap-2 before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
            Ou continue com
          </div>
          <button
            type="button"
            disabled
            className="flex min-h-9 items-center justify-center gap-2 rounded-sm border border-[var(--border)] text-[var(--muted-foreground)]"
          >
            <img src="/assets/figma/google.svg" alt="" aria-hidden="true" />
            Continuar com Google
          </button>
          <button
            type="button"
            disabled
            className="flex min-h-9 items-center justify-center gap-2 rounded-sm border border-[var(--border)] text-[var(--muted-foreground)]"
          >
            <img src="/assets/figma/facebook.svg" alt="" aria-hidden="true" />
            Continuar com Facebook
          </button>
      </div>
      {!modal && (
        <>
          <p className=" pt-9 text-center text-xs text-[var(--muted-foreground)] md:hidden">
            {isLogin ? "Novo na Kurio? " : "Já tem uma conta? "}
            <Link to={isLogin ? "/register" : "/login"} search={{ redirect }} className="hover:text-[var(--accent)]">
              {isLogin ? "Crie uma conta" : "Entre"}
            </Link>
          </p>
          <p className="mt-6 hidden text-xs text-[var(--muted-foreground)] md:block">
          Credenciais de teste: ana@junglegaming.test / jungle123
          </p>
        </>
      )}
    </section>
  );

  return modal ? (
    content
  ) : (
    <main className="mx-auto flex min-h-dvh max-w-[1200px] justify-center bg-[#1d1d1d] md:min-h-[calc(100vh-90px)] md:items-center md:bg-transparent md:px-0 md:py-12">
      {content}
    </main>
  );
}
