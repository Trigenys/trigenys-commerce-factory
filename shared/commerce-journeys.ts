export const orderStatuses = ["requested", "confirmed", "preparing", "ready", "completed", "cancelled"] as const;
export type OrderStatus = typeof orderStatuses[number];
export const paymentMethods = ["orange_money", "momo", "cash"] as const;
export type PaymentMethod = typeof paymentMethods[number];
export type PaymentStatus = "pending" | "paid" | "refunded";
export type MemberRole = "owner" | "staff";
export type CartSelection = { productId:string; quantity:number; variants:Record<string,string> };
export type OrderLine = CartSelection & { name:string; slug:string; unitPrice:string; amount:string };
export type OrderEvent = { at:string; status:OrderStatus; paymentStatus:PaymentStatus };
export type PublicOrder = {
  id:string; storeSlug:string; storeName:string; reference:string; status:OrderStatus;
  paymentMethod:PaymentMethod; paymentStatus:PaymentStatus; currencyCode:string;
  total:string; lines:OrderLine[]; createdAt:string; updatedAt:string; version:number; history:OrderEvent[];
};
export type MerchantOrder = PublicOrder & { customerName:string|null; customerPhone:string|null; note:string|null };
export type OrderCreateInput = { idempotencyKey:string; trackingToken:string; lines:CartSelection[]; paymentMethod:PaymentMethod; customerName:string|null; customerPhone:string|null; note:string|null };
export type OrderPatch = { expectedVersion:number; status?:OrderStatus; paymentStatus?:PaymentStatus };
export type Invitation = { id:string; email:string; expiresAt:string; revokedAt:string|null; acceptedAt:string|null };
export type StoreMember = { email?:string; id:string; subject:string; role:MemberRole; createdAt:string };
export type SupportStatus = "open"|"in_progress"|"resolved";
export type PublicSupportTicket = { id:string; status:SupportStatus; createdAt:string; updatedAt:string; reply:string|null };
export type SupportTicket = PublicSupportTicket & { name:string; email:string; message:string; storeSlug:string|null };
export type PlatformStore = { id:string; name:string; slug:string; status:string; createdAt:string; productCount:number };

export function canTransitionOrder(from:OrderStatus, to:OrderStatus):boolean {
  const next:Record<OrderStatus, readonly OrderStatus[]> = { requested:["confirmed","cancelled"], confirmed:["preparing","cancelled"], preparing:["ready","cancelled"], ready:["completed","cancelled"], completed:[], cancelled:[] };
  return from === to || next[from].includes(to);
}

export const orderLabels = {
  fr: { requested:"À confirmer",confirmed:"Confirmée",preparing:"En préparation",ready:"Prête",completed:"Remise au client",cancelled:"Annulée",pending:"Paiement à confirmer",paid:"Paiement confirmé",refunded:"Remboursement confirmé",orange_money:"Orange Money",momo:"MTN MoMo",cash:"Espèces" },
  en: { requested:"Awaiting confirmation",confirmed:"Confirmed",preparing:"Preparing",ready:"Ready",completed:"Handed to customer",cancelled:"Cancelled",pending:"Payment pending",paid:"Payment confirmed",refunded:"Refund confirmed",orange_money:"Orange Money",momo:"MTN MoMo",cash:"Cash" }
};
