"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { PageSection } from "@/components/shared/ui";
import {
  createPartnerSchema,
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
    formState: { errors },
  } = useForm<CreatePartnerInput>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      monthlyCommitment: 50,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await createPartner.mutateAsync(values);
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
      <PageSection
        title="Member details"
        description="Creates a real Nomba virtual account via API. Sandbox allows max 2 accounts; inbound transfers are capped at ₦150."
      >
        <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Full name
            </label>
            <input
              {...register("fullName")}
              className="input-field"
              placeholder="Sister Grace Adeyemi"
            />
            {errors.fullName && (
              <p className="mt-1.5 text-sm text-danger">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Phone
            </label>
            <input
              {...register("phone")}
              className="input-field"
              placeholder="08012345678"
            />
            {errors.phone && (
              <p className="mt-1.5 text-sm text-danger">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Email <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              {...register("email")}
              type="email"
              className="input-field"
              placeholder="grace@email.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-danger">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Monthly commitment (₦)
            </label>
            <input
              {...register("monthlyCommitment", { valueAsNumber: true })}
              type="number"
              className="input-field"
            />
            {errors.monthlyCommitment && (
              <p className="mt-1.5 text-sm text-danger">
                {errors.monthlyCommitment.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createPartner.isPending}
              className="btn-primary"
            >
              {createPartner.isPending ? "Creating account…" : "Create dedicated account"}
            </button>
          </div>
        </form>
      </PageSection>
    </AppShell>
  );
}
