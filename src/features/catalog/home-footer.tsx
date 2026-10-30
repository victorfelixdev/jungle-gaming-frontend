import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    initial: "W",
    title: "Segurança da carteira",
    description:
      "Proteja sua carteira e colecione arte digital verificada com confiança.",
  },
  {
    initial: "C",
    title: "Criadores em destaque",
    description:
      "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
  },
  {
    initial: "D",
    title: "Alertas de lançamentos",
    description:
      "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
  },
];

const profileItems = [
  "Meu perfil",
  "Minha coleção",
  "Atividade",
  "Estúdio do criador",
  "Lista de interesse",
];

const helpItems = [
  "Central de ajuda",
  "Como comprar NFTs",
  "Carteira e segurança",
  "Política do mercado",
  "Denunciar item",
];

const collectionItems = [
  { label: "Arte digital", category: "Arte" },
  { label: "Fotografia", category: "Fotografia" },
  { label: "Música", category: "Música" },
  { label: "Arte 3D", category: "Arte 3D" },
  { label: "Utilidade", category: "Utilidade" },
];

const socialIcons = [
  { label: "Facebook", image: "/assets/figma/facebook.svg" },
  { label: "Instagram", symbol: "◎" },
  { label: "Twitter", symbol: "𝕏" },
  { label: "LinkedIn", symbol: "in" },
  { label: "YouTube", symbol: "▶" },
];

export function HomeFooter({
  onSelectCategory,
}: {
  onSelectCategory: (category: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  const saveEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim();
    if (!normalized) return;
    localStorage.setItem("kurio-newsletter-email", normalized);
    setEmailSaved(true);
  };

  return (
    <footer role="contentinfo" aria-label="Rodapé da Kurio" className="mt-24">
      <div className="grid grid-cols-1 gap-8 bg-[var(--surface-card)] px-8 py-8 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.4fr] lg:gap-0">
        {benefits.map((benefit) => (
          <div
            key={benefit.initial}
            className="lg:border-r lg:border-[var(--primary)] lg:px-4 first:lg:pl-0"
          >
            <span
              aria-hidden="true"
              className="grid size-[60px] place-items-center rounded-full bg-[var(--primary)] text-lg font-bold text-[var(--background)]"
            >
              {benefit.initial}
            </span>
            <h2 className="mt-3 text-sm font-bold">{benefit.title}</h2>
            <p className="mt-2 max-w-48 text-xs leading-5 text-[var(--muted-foreground)]">
              {benefit.description}
            </p>
          </div>
        ))}
        <div className="min-w-0 lg:pl-4">
          <h2 className="max-w-56 text-sm font-bold leading-4">
            Antecipe-se ao próximo lançamento
          </h2>
          <form onSubmit={saveEmail} className="mt-3 flex min-h-9">
            <label htmlFor="newsletter-email" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailSaved(false);
              }}
              placeholder="digite seu e-mail..."
              className="min-w-0 flex-1 rounded-l-md bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
            <Button
              type="submit"
              className="min-h-9 rounded-l-none rounded-r-md px-3 text-xs"
            >
              Enviar
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
            {emailSaved
              ? "E-mail salvo neste navegador."
              : "Receba lançamentos selecionados, histórias de criadores e novidades do mercado."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 bg-[var(--surface)] px-8 py-7 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
        <strong className="tracking-[0.1em]">KURIO</strong>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid gap-8 bg-[var(--surface-card)] px-8 py-9 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="text-sm font-bold">Meu perfil</h2>
          <ul className="mt-3 grid gap-3">
            {profileItems.map((item) => (
              <li key={item} className="cursor-not-allowed">
                {item === "Meu perfil" ? (
                  <Link to="/profile" className="cursor-pointerhover:text-[var(--accent)]">
                    {item}
                  </Link>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold">Central de ajuda</h2>
          <ul className="mt-3 grid gap-3">
            {helpItems.map((item) => (
              <li key={item} className="cursor-not-allowed">{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold">Coleções</h2>
          <ul className="mt-3 grid gap-3">
            {collectionItems.map((item) => (
              <li key={item.category}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(item.category)}
                  className="cursor-pointer text-left hover:text-[var(--accent)]"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold">Redes sociais</h2>
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Redes sociais da Kurio"
          >
            {socialIcons.map(({ label, image, symbol }) => (
              <span
                key={label}
                title={label}
                className="grid size-7 place-items-center rounded border border-[var(--primary)] text-[var(--primary)] cursor-not-allowed"
              >
                {image ? (
                  <img src={image} alt="" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-sm font-bold leading-none"
                  >
                    {symbol}
                  </span>
                )}
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </div>
          <h2 className="mt-7 text-sm font-bold">Carteiras compatíveis</h2>
          <p className="mt-2 w-fit rounded bg-[var(--surface)] px-2 py-1 text-[9px] text-[var(--accent)]">
            METAMASK · WALLETCONNECT · COINBASE
          </p>
        </div>
      </div>
      <p className="py-6 text-center text-xs text-[var(--foreground)]">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  );
}
