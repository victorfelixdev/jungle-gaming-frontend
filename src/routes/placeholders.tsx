import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CatalogPage } from "@/features/catalog/catalog-page";
import { CartPage } from "@/features/cart/cart-page";
import { NftDetailPage } from "@/features/catalog/nft-detail-page";
import { AuthForm } from "@/features/auth/auth-form";
import { ProfilePage } from "@/features/auth/profile-page";
import { WalletsPage } from "@/features/auth/wallets-page";
import { CheckoutPage } from "@/features/checkout/checkout-page";
import { OrderReceiptPage } from "@/features/checkout/order-receipt-page";
import { MockControlsPage } from "@/features/mocks/mock-controls-page";

export function CatalogRoute() {
  return <CatalogPage />;
}

export function NftRoute() {
  return <NftDetailPage />;
}

export function CartRoute() {
  return <CartPage />;
}
export function CheckoutRoute() {
  return <CheckoutPage />;
}
export function OrderRoute() {
  return <OrderReceiptPage />;
}
export function ProfileRoute() {
  return <ProfilePage />;
}
export function WalletsRoute() {
  return <WalletsPage />;
}

export function MockControlsRoute() {
  return <MockControlsPage />;
}

export function LoginRoute() {
  const { redirect } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  return (
    <>
      <div className="md:hidden">
        <AuthForm mode="login" redirect={redirect} />
      </div>
      <main className="hidden min-h-[calc(100vh-64px)] items-center justify-center px-6 py-10 md:flex">
        <AuthForm
          mode="login"
          modal
          onClose={() => void navigate({ to: "/", search: { page: 1, pageSize: 9, sort: "featured" } })}
          onComplete={() => void navigate({ to: redirect?.startsWith("/") ? redirect : "/" })}
          onModeChange={(mode) => {
            if (mode === "register") void navigate({ to: "/register", search: { redirect } });
          }}
        />
      </main>
    </>
  );
}

export function RegisterRoute() {
  const { redirect } = useSearch({ from: "/register" });
  return <AuthForm mode="register" redirect={redirect} />;
}

export function NotFoundRoute() {
  return (
    <Page
      title="Página não encontrada"
      detail="A rota solicitada não existe."
      action={
        <Link to="/" search={{ page: 1, pageSize: 9, sort: "featured" }}>
          Voltar ao marketplace
        </Link>
      }
    />
  );
}

function Page({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-3 max-w-xl leading-7 text-[var(--muted-foreground)]">
        {detail}
      </p>
      {action && <p className="mt-6 text-[var(--accent)]">{action}</p>}
    </main>
  );
}
