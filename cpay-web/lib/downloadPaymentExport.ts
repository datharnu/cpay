import api from "@/api/axios";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildFilename(params: {
  from: string;
  to: string;
  partnerName?: string;
}) {
  const scope = params.partnerName
    ? params.partnerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
    : "all-members";
  return `cpay-payments-${scope}-${params.from}-to-${params.to}.csv`;
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === "object" && data && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "Could not download payment history.";
}

export async function downloadPaymentExport(params: {
  from: string;
  to: string;
  partnerId?: string;
  partnerName?: string;
}) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.partnerId) {
    search.set("partnerId", params.partnerId);
  }

  try {
    const response = await api.get(`/api/payments/export?${search.toString()}`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    triggerBlobDownload(
      blob,
      buildFilename({
        from: params.from,
        to: params.to,
        partnerName: params.partnerName,
      })
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err &&
      "response" in err &&
      (err as { response?: { data?: unknown } }).response?.data instanceof Blob
    ) {
      const text = await (err as { response: { data: Blob } }).response.data.text();
      try {
        throw new Error(extractErrorMessage(JSON.parse(text)));
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== "Could not download payment history.") {
          throw parseErr;
        }
        throw new Error("Could not download payment history.");
      }
    }
    throw err;
  }
}

export function defaultExportFromDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
}

export function defaultExportToDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
