export type PartnerListItem = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  monthlyCommitment: number;
  virtualAccountNumber?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  creditBalance: number;
  status: string;
  arrears: number;
  monthsPaid: number;
  monthsMissed: number;
};

export type DashboardSummary = {
  totalPartners: number;
  activePartners: number;
  totalPayments: number;
  unmatchedPayments: number;
  totalArrears: number;
  pendingOverpayments: number;
  pendingRefunds: number;
  recentOverpayments: Array<{
    id: string;
    partnerId: string;
    partnerName: string;
    excess: number;
    status: string;
    createdAt: string;
  }>;
  recentPendingRefunds: Array<{
    id: string;
    partnerId: string;
    partnerName: string;
    excess: number;
    merchantTxRef?: string | null;
    refundAccountName?: string | null;
    refundAccountNumber?: string | null;
    createdAt: string;
  }>;
  recentUnmatched: Array<{
    id: string;
    amount: number;
    virtualAccountNumber?: string | null;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    partnerId?: string | null;
    partnerName?: string | null;
    amount: number;
    classification?: string | null;
    virtualAccountNumber?: string | null;
    senderName?: string | null;
    createdAt: string;
  }>;
};

export type PartnerDetail = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  monthlyCommitment: number;
  virtualAccountNumber?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  creditBalance: number;
  arrears: number;
  nombaVaStatus?: { verified: boolean; expired?: boolean } | null;
  months: Array<{
    year: number;
    month: number;
    expected: number;
    paid: number;
    status: string;
    label: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    classification?: string | null;
    senderName?: string | null;
    nombaTransactionId?: string | null;
    createdAt: string;
  }>;
  overpayments: Array<{
    id: string;
    paymentId: string;
    excess: number;
    status: string;
    choice?: string | null;
    merchantTxRef?: string | null;
    refundAccountName?: string | null;
    refundAccountNumber?: string | null;
    createdAt: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }>;
};

export type OverpaymentCase = {
  id: string;
  partnerId: string;
  partnerName: string;
  paymentId: string;
  paymentAmount: number;
  excess: number;
  status: string;
  createdAt: string;
};

export type ResolveOverpaymentInput =
  | { choice: "credit_next_month" }
  | {
      choice: "refund";
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };

export type ReconciliationResult = {
  drifts: Array<{
    partnerName?: string;
    virtualAccountNumber?: string;
    amountNaira: number;
    issue: string;
  }>;
  nombaCount: number;
  localCount: number;
  syncedAt: string;
};
