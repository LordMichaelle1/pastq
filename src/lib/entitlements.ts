import { Platform } from "react-native";
import Purchases, { type CustomerInfo, type PurchasesOffering } from "react-native-purchases";

/** Entitlement identifier as configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = "pro";

/** Subjects a free account may keep. Hitting this is the paywall moment. */
export const FREE_SUBJECT_LIMIT = 1;

const apiKey = Platform.select({
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  default: undefined,
});

/**
 * RevenueCat needs a native module, so it is unavailable in Expo Go and before
 * the keys are set. Rather than crash, the app treats those cases as "free
 * account, purchasing unavailable" and hides the buy button. Everything else in
 * the app works untouched.
 */
export type BillingStatus = "ready" | "unconfigured" | "unavailable";

let status: BillingStatus = apiKey ? "ready" : "unconfigured";
let initialised = false;

export function billingStatus(): BillingStatus {
  return status;
}

export async function initBilling(): Promise<BillingStatus> {
  if (initialised || !apiKey) return status;
  initialised = true;

  try {
    Purchases.configure({ apiKey });
    status = "ready";
  } catch (error) {
    // Expo Go, or a build without the native module linked.
    console.warn("[billing] RevenueCat unavailable:", error);
    status = "unavailable";
  }

  return status;
}

function hasPro(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}

export async function isPro(): Promise<boolean> {
  if (status !== "ready") return false;

  try {
    return hasPro(await Purchases.getCustomerInfo());
  } catch (error) {
    // Offline, or the customer has never been fetched. Fail closed to free —
    // never fail open, or the paywall stops meaning anything.
    console.warn("[billing] could not read entitlements:", error);
    return false;
  }
}

export async function currentOffering(): Promise<PurchasesOffering | null> {
  if (status !== "ready") return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.warn("[billing] could not load offerings:", error);
    return null;
  }
}

export type PurchaseResult =
  | { ok: true; pro: boolean }
  | { ok: false; cancelled: boolean; message: string };

export async function purchasePro(): Promise<PurchaseResult> {
  const offering = await currentOffering();
  const pkg = offering?.availablePackages[0];

  if (!pkg) {
    return { ok: false, cancelled: false, message: "No subscription is available right now." };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, pro: hasPro(customerInfo) };
  } catch (error) {
    const cancelled = Boolean((error as { userCancelled?: boolean }).userCancelled);
    return {
      ok: false,
      cancelled,
      message: cancelled ? "Purchase cancelled." : "That purchase did not go through.",
    };
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (status !== "ready") return false;

  try {
    return hasPro(await Purchases.restorePurchases());
  } catch (error) {
    console.warn("[billing] restore failed:", error);
    return false;
  }
}
