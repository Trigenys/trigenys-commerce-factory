import type { Invitation, MerchantOrder, OrderCreateInput, OrderLine, OrderPatch, PlatformStore, PublicOrder, PublicSupportTicket, StoreMember, SupportStatus, SupportTicket } from "../../shared/commerce-journeys.ts";

export type QuotedOrder = { id:string; input:OrderCreateInput; payloadHash:string; trackingHash:string; lines:OrderLine[]; total:string; currencyCode:string };
export type SupportInput = { id:string; trackingHash:string; name:string; email:string; message:string; storeSlug:string|null };
type Failure<K extends string> = {[Key in K]: {kind:Key}}[K];
export interface JourneyRepository {
  createOrder(storeSlug:string, quote:QuotedOrder):Promise<{kind:"created";order:PublicOrder}|{kind:"existing";order:PublicOrder}|Failure<"conflict"|"catalog_changed">>;
  getOrderRequest(slug:string,key:string,trackingHash:string):Promise<{order:PublicOrder;payloadHash:string;whatsappNumber:string}|null>;
  getPublicOrder(id:string,trackingHash:string):Promise<PublicOrder|null>;
  listOrders(subject:string,storeId:string):Promise<MerchantOrder[]|null>;
  updateOrder(subject:string,storeId:string,id:string,patch:OrderPatch):Promise<{kind:"updated";order:MerchantOrder}|Failure<"not_found"|"conflict"|"invalid_transition"|"forbidden">>;
  listTeam(subject:string,storeId:string):Promise<{members:StoreMember[];invitations:Invitation[]}|null>;
  createInvitation(subject:string,storeId:string,id:string,email:string,tokenHash:string):Promise<Invitation|null>;
  revokeInvitation(subject:string,storeId:string,id:string):Promise<boolean>;
  removeMember(subject:string,storeId:string,id:string):Promise<boolean>;
  acceptInvitation(subject:string,email:string,tokenHash:string):Promise<{storeId:string}|null>;
  hasPlatformAccess(subject:string):Promise<boolean>;
  listPlatformStores(subject:string,query:string):Promise<PlatformStore[]|null>;
  createSupport(input:SupportInput):Promise<PublicSupportTicket|null>;
  getPublicSupport(id:string,trackingHash:string):Promise<PublicSupportTicket|null>;
  listSupport(subject:string):Promise<SupportTicket[]|null>;
  updateSupport(subject:string,id:string,status:SupportStatus,reply:string):Promise<SupportTicket|null>;
}
