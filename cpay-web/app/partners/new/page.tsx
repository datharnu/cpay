"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell, formatMoney } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { PageSection } from "@/components/shared/ui";
import {
  createPartnerSchema,
  defaultPartnershipStartMonth,
  FREQUENCY_OPTIONS,
  planHelperText,
  type CreatePartnerInput,
} from "@/app/utils/SchemaData";
import { useCreatePartner } from "@/hooks/useCpay";
import axios from "axios";

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ??
      "Could not create partner. Sandbox allows max 2 virtual accounts."
    );
  }
  return "Could not create partner.";
}

export default function NewPartnerPage() {
  const router = useRouter();
  const createPartner = useCreatePartner();
  const { warning } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreatePartnerInput>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      pledgeTotal: 600,
      frequency: "monthly",
      installmentCount: 12,
      partnershipStartMonth: defaultPartnershipStartMonth(),
    },
  });

  const pledgeTotal = useWatch({ control, name: "pledgeTotal" });
  const frequency = useWatch({ control, name: "frequency" });
  const installmentCount = useWatch({ control, name: "installmentCount" });

  const planText = planHelperText({
    pledgeTotal: Number(pledgeTotal) || 0,
    frequency: frequency ?? "monthly",
    installmentCount:
      frequency === "one_off" ? 1 : Math.max(1, Number(installmentCount) || 1),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = {
        ...values,
        installmentCount:
          values.frequency === "one_off" ? 1 : values.installmentCount,
      };
      const result = await createPartner.mutateAsync(payload);
      router.push(`/partners/${result.id}`);
    } catch (error) {
      const message = getErrorMessage(error);
      const isSandboxLimit = message.toLowerCase().includes("sandbox limit");
      if (isSandboxLimit) {
        warning(message, 8000);
      } else {
        warning(message);
      }
    }
  });

  return (
    <AppShell title="Add partnership member">
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center py-6 lg:min-h-[calc(100dvh-11rem)]">
        <PageSection
          title="Member details"
          description="Set the full amount they agreed to give, how often they will pay, and how many payments. CPay creates a dedicated Nomba account for them."
        >
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-base font-medium text-text-primary">
                  Full name
                </label>
                <input
                  {...register("fullName")}
                  className="input-field py-3.5 px-4 text-base"
                  placeholder="Sister Grace Adeyemi"
                />
                {errors.fullName && (
                  <p className="mt-1.5 text-sm text-danger">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-text-primary">
                  Phone
                </label>
                <input
                  {...register("phone")}
                  className="input-field py-3.5 px-4 text-base"
                  placeholder="08012345678"
                />
                {errors.phone && (
                  <p className="mt-1.5 text-sm text-danger">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-text-primary">
                  Email <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <input
                  {...register("email")}
                  type="email"
                  className="input-field py-3.5 px-4 text-base"
                  placeholder="grace@email.com"
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-danger">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-text-primary">
                  Start paying from
                </label>
                <input
                  {...register("partnershipStartMonth")}
                  type="month"
                  className="input-field py-3.5 px-4 text-base"
                />
                {errors.partnershipStartMonth && (
                  <p className="mt-1.5 text-sm text-danger">
                    {errors.partnershipStartMonth.message}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/40 p-5 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">Payment plan</p>
              <p className="mt-1 text-sm text-text-secondary">
                Example: ₦600,000 total, paid every month for 12 months.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-base font-medium text-text-primary">
                    Total amount (₦)
                  </label>
                  <input
                    {...register("pledgeTotal", { valueAsNumber: true })}
                    type="number"
                    min={1}
                    className="input-field py-3.5 px-4 text-base"
                    placeholder="600000"
                  />
                  {errors.pledgeTotal && (
                    <p className="mt-1.5 text-sm text-danger">
                      {errors.pledgeTotal.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-base font-medium text-text-primary">
                    How often
                  </label>
                  <select
                    {...register("frequency", {
                      onChange: (event) => {
                        if (event.target.value === "one_off") {
                          setValue("installmentCount", 1);
                        }
                      },
                    })}
                    className="input-field py-3.5 px-4 text-base"
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.frequency && (
                    <p className="mt-1.5 text-sm text-danger">
                      {errors.frequency.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-base font-medium text-text-primary">
                    Number of payments
                  </label>
                  <input
                    {...register("installmentCount", { valueAsNumber: true })}
                    type="number"
                    min={1}
                    disabled={frequency === "one_off"}
                    className="input-field py-3.5 px-4 text-base disabled:opacity-60"
                  />
                  {errors.installmentCount && (
                    <p className="mt-1.5 text-sm text-danger">
                      {errors.installmentCount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-primary/15 bg-primary-subtle/50 px-4 py-3 text-sm text-text-primary">
                <p className="font-medium text-primary">Plan summary</p>
                <p className="mt-1 leading-relaxed">{planText}</p>
                {Number(pledgeTotal) > 0 && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Expected this month (approx.):{" "}
                    {formatMoney(
                      frequency === "weekly"
                        ? (Number(pledgeTotal) /
                            Math.max(1, Number(installmentCount) || 1)) *
                          4
                        : frequency === "biweekly"
                          ? (Number(pledgeTotal) /
                              Math.max(1, Number(installmentCount) || 1)) *
                            2
                          : frequency === "bimonthly"
                            ? Number(pledgeTotal) /
                              Math.max(1, Number(installmentCount) || 1) /
                              2
                            : frequency === "semiannual"
                              ? Number(pledgeTotal) /
                                Math.max(1, Number(installmentCount) || 1) /
                                6
                              : Number(pledgeTotal) /
                                Math.max(
                                  1,
                                  frequency === "one_off"
                                    ? 1
                                    : Number(installmentCount) || 1
                                )
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={createPartner.isPending}
                className="btn-primary px-6 py-3 text-base"
              >
                {createPartner.isPending ? "Creating account…" : "Create dedicated account"}
              </button>
            </div>
          </form>
        </PageSection>
      </div>
    </AppShell>
  );
}
