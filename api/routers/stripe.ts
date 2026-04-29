import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2026-04-22.dahlia" }) : null;

const PRICE_MAP: Record<string, number> = {
  "30-Day Visit Visa": 120000, // cents in fils (1200 AED)
  "60-Day Visit Visa": 180000, // 1800 AED
  "Visa Extension": 110000, // 1100 AED
  "Inside Country Status Change": 0,
  "PRO Services": 0,
};

export const stripeRouter = createRouter({
  createPaymentIntent: publicQuery
    .input(
      z.object({
        applicationId: z.number().optional(),
        visaType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (!stripe) {
        throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
      }

      const amount = PRICE_MAP[input.visaType] || 0;
      if (amount === 0) {
        throw new Error("This service requires manual pricing. Please contact us.");
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "aed",
        automatic_payment_methods: { enabled: true },
        metadata: {
          applicationId: String(input.applicationId || ""),
          visaType: input.visaType,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      };
    }),

  getPublishableKey: publicQuery.query(() => {
    return { key: process.env.VITE_STRIPE_PUBLIC_KEY || "" };
  }),
});
