"use client";

import api from "@/api/axios";
import { useEffect, useState } from "react";

export function useDebouncedBankLookup(
  bankCode: string,
  accountNumber: string,
  enabled: boolean
) {
  const [accountName, setAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const digits = accountNumber.replace(/\D/g, "");

  useEffect(() => {
    if (!enabled || digits.length !== 10 || !bankCode) {
      setAccountName(null);
      setLoading(false);
      setError(null);
      setVerified(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post<{
          data: { accountName: string; accountNumber: string };
        }>("/api/reconciliation/transfers/lookup", {
          bankCode,
          accountNumber: digits,
        });
        if (cancelled) return;
        setAccountName(data.data.accountName);
        setVerified(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setAccountName(null);
        setVerified(false);
        const message =
          err &&
          typeof err === "object" &&
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "data" in err.response &&
          err.response.data &&
          typeof err.response.data === "object" &&
          "message" in err.response.data &&
          typeof err.response.data.message === "string"
            ? err.response.data.message
            : "Could not verify account — select the correct bank or enter the name manually.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bankCode, digits, enabled]);

  return { accountName, loading, error, verified, digits };
}
