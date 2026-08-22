import { UserCircle2, Inbox, Rocket, UserCog, CreditCard } from "lucide-react";

export type ActivityCategory = "signup" | "request" | "server" | "admin" | "payment";

export interface ActivityEvent {
  type: string;
  category: ActivityCategory;
  description: string;
  timestamp: string;
}

export const activityCategoryIcon: Record<ActivityCategory, typeof UserCircle2> = {
  signup: UserCircle2,
  request: Inbox,
  server: Rocket,
  admin: UserCog,
  payment: CreditCard,
};

export const activityCategoryLabel: Record<ActivityCategory, string> = {
  signup: "Signups",
  request: "Server requests",
  server: "Servers",
  admin: "Account admin",
  payment: "Payments",
};
