export type InvoiceStatus = "paid" | "pending" | "failed";

export interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
}

