import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../db";

export class Partner extends Model<
  InferAttributes<Partner>,
  InferCreationAttributes<Partner>
> {
  declare id: CreationOptional<string>;
  declare fullName: string;
  declare phone: string;
  declare email: CreationOptional<string | null>;
  declare monthlyCommitmentKobo: number;
  declare accountRef: string;
  declare virtualAccountNumber: CreationOptional<string | null>;
  declare bankName: CreationOptional<string | null>;
  declare bankAccountName: CreationOptional<string | null>;
  declare creditBalanceKobo: CreationOptional<number>;
  declare joinedAt: CreationOptional<Date>;
  /** First calendar month the member committed to pay (may differ from registration date). */
  declare partnershipStartYear: CreationOptional<number>;
  declare partnershipStartMonth: CreationOptional<number>;
  declare status: CreationOptional<"active" | "inactive">;
}

Partner.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    monthlyCommitmentKobo: { type: DataTypes.INTEGER, allowNull: false },
    accountRef: { type: DataTypes.STRING, allowNull: false, unique: true },
    virtualAccountNumber: { type: DataTypes.STRING, allowNull: true },
    bankName: { type: DataTypes.STRING, allowNull: true },
    bankAccountName: { type: DataTypes.STRING, allowNull: true },
    creditBalanceKobo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    partnershipStartYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    partnershipStartMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  { sequelize, tableName: "partners" }
);

export class PartnerMonth extends Model<
  InferAttributes<PartnerMonth>,
  InferCreationAttributes<PartnerMonth>
> {
  declare id: CreationOptional<string>;
  declare partnerId: string;
  declare year: number;
  declare month: number;
  declare expectedKobo: number;
  declare paidKobo: CreationOptional<number>;
  declare status: CreationOptional<"paid" | "partial" | "missed" | "pending">;
}

PartnerMonth.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    partnerId: { type: DataTypes.UUID, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    month: { type: DataTypes.INTEGER, allowNull: false },
    expectedKobo: { type: DataTypes.INTEGER, allowNull: false },
    paidKobo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM("paid", "partial", "missed", "pending"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  {
    sequelize,
    tableName: "partner_months",
    indexes: [{ unique: true, fields: ["partnerId", "year", "month"] }],
  }
);

export class Payment extends Model<
  InferAttributes<Payment>,
  InferCreationAttributes<Payment>
> {
  declare id: CreationOptional<string>;
  declare partnerId: CreationOptional<string | null>;
  declare amountKobo: number;
  declare classification: CreationOptional<
    "exact" | "under" | "over" | "unmatched" | "catch_up"
  >;
  declare nombaTransactionId: CreationOptional<string | null>;
  declare sessionId: CreationOptional<string | null>;
  declare senderName: CreationOptional<string | null>;
  declare virtualAccountNumber: CreationOptional<string | null>;
  declare requestId: string;
  declare rawPayload: CreationOptional<string | null>;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    partnerId: { type: DataTypes.UUID, allowNull: true },
    amountKobo: { type: DataTypes.INTEGER, allowNull: false },
    classification: {
      type: DataTypes.ENUM("exact", "under", "over", "unmatched", "catch_up"),
      allowNull: true,
    },
    nombaTransactionId: { type: DataTypes.STRING, allowNull: true },
    sessionId: { type: DataTypes.STRING, allowNull: true },
    senderName: { type: DataTypes.STRING, allowNull: true },
    virtualAccountNumber: { type: DataTypes.STRING, allowNull: true },
    requestId: { type: DataTypes.STRING, allowNull: false, unique: true },
    rawPayload: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: "payments" }
);

export class WebhookEvent extends Model<
  InferAttributes<WebhookEvent>,
  InferCreationAttributes<WebhookEvent>
> {
  declare id: CreationOptional<string>;
  declare requestId: string;
  declare eventType: string;
  declare processedAt: CreationOptional<Date>;
}

WebhookEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: { type: DataTypes.STRING, allowNull: false, unique: true },
    eventType: { type: DataTypes.STRING, allowNull: false },
    processedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "webhook_events" }
);

export class OverpaymentCase extends Model<
  InferAttributes<OverpaymentCase>,
  InferCreationAttributes<OverpaymentCase>
> {
  declare id: CreationOptional<string>;
  declare partnerId: string;
  declare paymentId: string;
  declare excessKobo: number;
  declare status: CreationOptional<
    "pending_choice" | "credited" | "refund_pending" | "refunded"
  >;
  declare choice: CreationOptional<"credit_next_month" | "refund" | null>;
  declare merchantTxRef: CreationOptional<string | null>;
  declare refundBankCode: CreationOptional<string | null>;
  declare refundAccountNumber: CreationOptional<string | null>;
  declare refundAccountName: CreationOptional<string | null>;
  declare resolvedAt: CreationOptional<Date | null>;
}

OverpaymentCase.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    partnerId: { type: DataTypes.UUID, allowNull: false },
    paymentId: { type: DataTypes.UUID, allowNull: false, unique: true },
    excessKobo: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending_choice",
    },
    choice: {
      type: DataTypes.ENUM("credit_next_month", "refund"),
      allowNull: true,
    },
    merchantTxRef: { type: DataTypes.STRING, allowNull: true },
    refundBankCode: { type: DataTypes.STRING, allowNull: true },
    refundAccountNumber: { type: DataTypes.STRING, allowNull: true },
    refundAccountName: { type: DataTypes.STRING, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: "overpayment_cases" }
);

export class PartnerNotification extends Model<
  InferAttributes<PartnerNotification>,
  InferCreationAttributes<PartnerNotification>
> {
  declare id: CreationOptional<string>;
  declare partnerId: string;
  declare paymentId: CreationOptional<string | null>;
  declare type: "underpayment" | "overpayment_pending" | "overpayment_resolved";
  declare title: string;
  declare message: string;
  declare read: CreationOptional<boolean>;
}

PartnerNotification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    partnerId: { type: DataTypes.UUID, allowNull: false },
    paymentId: { type: DataTypes.UUID, allowNull: true },
    type: {
      type: DataTypes.ENUM(
        "underpayment",
        "overpayment_pending",
        "overpayment_resolved"
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: "partner_notifications" }
);

Partner.hasMany(PartnerMonth, { foreignKey: "partnerId", as: "months" });
PartnerMonth.belongsTo(Partner, { foreignKey: "partnerId" });
Partner.hasMany(Payment, { foreignKey: "partnerId", as: "payments" });
Payment.belongsTo(Partner, { foreignKey: "partnerId" });
Partner.hasMany(OverpaymentCase, { foreignKey: "partnerId", as: "overpayments" });
OverpaymentCase.belongsTo(Partner, { foreignKey: "partnerId", as: "partner" });
OverpaymentCase.belongsTo(Payment, { foreignKey: "paymentId", as: "payment" });
Partner.hasMany(PartnerNotification, { foreignKey: "partnerId", as: "notifications" });
PartnerNotification.belongsTo(Partner, { foreignKey: "partnerId" });
