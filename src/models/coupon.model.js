import { Schema, model } from "mongoose";

const CouponUsageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // exactly one of these three is set per redemption - a coupon discounts a
    // single booking, a package purchase, or an order, never more than one, but the
    // same Coupon document/discount logic covers any of them
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    packagePurchase: {
      type: Schema.Types.ObjectId,
      ref: "PackagePurchase",
      default: null,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ProductDiscountSchema = new Schema(
  {
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    // prazno = važi za sve artikle, isto pravilo kao applicableServices/
    // applicablePackages iznad - ali samo OTKAD je admin uopšte uključio ovaj
    // blok (postojanje productDiscount objekta je taj "uključен" signal).
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { _id: false }
);

const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // ---- usluge/paketi (glavni, uvek aktivan deo kupona) ----
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    // gornja granica popusta kad je discountType "percentage" - bez efekta kod
    // "fixed" jer je iznos već fiksan. null = bez ograničenja. Sprečava scenario
    // gde procenat koji je razuman za uobičajenu uslugu/paket ispadne apsurdno
    // visok u RSD kad se primeni na neočekivano skupu stavku.
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // preimenovano iz minAppointmentValue - polje se odnosi na usluge I pakete,
    // ne samo na termine, ime je sad tačnije. Odvojeno od productDiscount.minOrderValue
    // ispod, koje važi isključivo za artikal-deo kupona.
    minValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxUses: {
      type: Number,
      default: null,
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },

    usageHistory: {
      type: [CouponUsageSchema],
      default: [],
    },

    applicableServices: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    applicablePackages: [{ type: Schema.Types.ObjectId, ref: "Package" }],

    // ---- artikli (opciono, isključeno po defaultu) ----
    // null = kupon uopšte NE važi za porudžbine artikala - namerno restriktivan
    // default, za razliku od usluga/paketa gde prazna applicableServices/
    // applicablePackages znači "važi za sve". Razlog: partnerski referalni kod
    // sa širokim dosegom (npr. 15%) ne sme automatski da se primeni i na skupe
    // aparate samo zato što niko nije eksplicitno isključio tu mogućnost - videti
    // productDiscount.discountType/discountValue, koji su namerno nezavisni od
    // gornjeg discountType/discountValue (usluge mogu biti na procentu, artikli
    // na fiksnom iznosu, ili obrnuto).
    productDiscount: {
      type: ProductDiscountSchema,
      default: null,
    },

    // when set, this coupon is a partner's affiliate/referral code - redeeming it
    // still discounts the customer normally, but also queues a commission entry
    // for this partner once the underlying appointment/order actually completes
    // (see commission.service.js)
    partner: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
      index: true,
    },

    validFrom: {
      type: Date,
      default: Date.now,
    },
    // null means "never expires" - the actual expiration check (coupon.service.js's
    // validateCoupon) already treats a missing validUntil this way; this was the
    // only place still forcing an end date to be required
    validUntil: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

CouponSchema.index({ isActive: 1, validUntil: 1 });
CouponSchema.index({ "usageHistory.user": 1 });
CouponSchema.index({ "usageHistory.appointment": 1 });
CouponSchema.index({ "usageHistory.packagePurchase": 1 });
CouponSchema.index({ "usageHistory.order": 1 });
CouponSchema.index({ "productDiscount.applicableProducts": 1 });

export default model("Coupon", CouponSchema);