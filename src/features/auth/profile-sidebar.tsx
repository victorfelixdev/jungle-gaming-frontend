import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CircleHelp,
  Download,
  Heart,
  LogOut,
  MapPin,
  Package,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { signOut } from "./session";

const inactiveItems = [
  { label: "Atividade", icon: ShoppingCart },
  { label: "Lista de interesse", icon: Heart },
  { label: "Ofertas", icon: Package },
  { label: "Arquivos baixados", icon: Download },
  { label: "Suporte", icon: CircleHelp },
];

export function ProfileSidebar({ active }: { active: "profile" | "wallets" }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const itemClass = (selected: boolean) =>
    `flex min-h-10 items-center gap-3 border-l-4 px-3 ${selected ? "border-[var(--primary)]" : "border-transparent hover:bg-[var(--surface-hover)]"}`;

  return (
    <aside className="h-fit bg-[var(--surface-card)] pt-4">
      <h1 className="px-3 text-base font-bold">Meu perfil</h1>
      <nav aria-label="Menu do perfil" className="mt-2 grid text-sm text-[var(--accent)]">
        <Link to="/profile" aria-current={active === "profile" ? "page" : undefined} className={itemClass(active === "profile")}>
          <UserRound size={16} /> Dados do perfil
        </Link>
        <Link to="/wallets" aria-current={active === "wallets" ? "page" : undefined} className={itemClass(active === "wallets")}>
          <MapPin size={16} /> Carteiras
        </Link>
        {inactiveItems.map(({ label, icon: Icon }) => (
          <span key={label} className="flex min-h-10 items-center gap-3 border-l-4 border-transparent px-3">
            <Icon size={16} /> {label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => void signOut(queryClient).then(() => navigate({ to: "/", search: { page: 1, pageSize: 9, sort: "featured" } }))}
          className="cursor-pointer mt-1 flex min-h-10 items-center gap-3 border-t border-[var(--border)] px-4 text-left hover:bg-[var(--surface-hover)]"
        >
          <LogOut size={16} /> Sair
        </button>
      </nav>
    </aside>
  );
}
