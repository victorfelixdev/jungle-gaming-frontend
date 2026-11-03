import type { CreateOrderInput } from "@/api/contracts";

const keyFor = (userId: string) => `kurio:pending-order:${userId}`;
const pendingCouponOrderKey = "kurio:pending-coupon-order";

export function readPendingOrder(userId: string): CreateOrderInput | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(keyFor(userId)) ?? "null") as CreateOrderInput | null;
    return value?.idempotencyKey && value.quote && value.walletId ? value : null;
  } catch {
    return null;
  }
}

export function savePendingOrder(userId: string, input: CreateOrderInput) {
  sessionStorage.setItem(keyFor(userId), JSON.stringify(input));
}

export function clearPendingOrder(userId: string) {
  sessionStorage.removeItem(keyFor(userId));
}

export function rememberPendingCouponOrder(orderId: string) {
  sessionStorage.setItem(pendingCouponOrderKey, orderId);
}

export function clearCouponAfterConfirmedOrder(orderId?: string) {
  if (orderId && sessionStorage.getItem(pendingCouponOrderKey) !== orderId) return;
  sessionStorage.removeItem("kurio:checkout-coupon");
  sessionStorage.removeItem(pendingCouponOrderKey);
}
