import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiArrowRight, HiCheckCircle, HiExclamationCircle } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { orderApi, type PaystackVerifyResponse } from "../../api/orders";
import { formatCurrency } from "../../data/products";
import "../styles/Checkout.css";

type VerifyState = "verifying" | "paid" | "failed" | "pending" | "unavailable";

const getReferenceFromParams = (searchParams: URLSearchParams) =>
  searchParams.get("reference") || searchParams.get("trxref") || "";

const CheckoutReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reference = useMemo(() => getReferenceFromParams(searchParams), [searchParams]);
  const [state, setState] = useState<VerifyState>(reference ? "verifying" : "failed");
  const [message, setMessage] = useState(
    reference ? "Checking secure payment status..." : "Payment reference is missing."
  );
  const [result, setResult] = useState<PaystackVerifyResponse | null>(null);

  useSEOMeta({
    title: "Payment status | Stroane",
    description: "Check the status of your Stroane Paystack payment.",
    canonical: "https://stroanesolutions.com/checkout/return",
    noIndex: true,
  });

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!reference) return;

      try {
        const response = await orderApi.verifyPaystackPayment(reference);
        if (cancelled) return;

        setResult(response);
        if (response.payment.status === "paid") {
          setState("paid");
          setMessage("Payment confirmed by Stroane. We will review fulfillment next.");
        } else if (response.payment.status === "failed" || response.payment.status === "abandoned") {
          setState("failed");
          setMessage("Payment was not completed. Your order remains available for follow-up.");
        } else {
          setState("pending");
          setMessage(
            response.payment.confirmationSource === "callback_status_check"
              ? "Paystack returned your payment status. Stroane is waiting for secure webhook confirmation before confirming the order."
              : "Payment is still pending. Please keep the reference for Stroane support."
          );
        }
      } catch (error) {
        if (cancelled) return;
        setState("unavailable");
        setMessage(
          error instanceof Error
            ? error.message
            : "Payment verification is unavailable. Please contact Stroane with your reference."
        );
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  const isSuccess = state === "paid";

  return (
    <Layout>
      <div className="checkout-page">
        <div className="checkout-confirm checkout-return">
          <span className={isSuccess ? "checkout-confirm__icon" : "checkout-confirm__icon checkout-confirm__icon--warning"}>
            {isSuccess ? (
              <HiCheckCircle size={56} aria-hidden="true" />
            ) : (
              <HiExclamationCircle size={56} aria-hidden="true" />
            )}
          </span>
          <span className="checkout-kicker">Payment status</span>
          <h1>
            {state === "verifying"
              ? "Checking payment"
              : isSuccess
              ? "Payment confirmed"
              : "Payment needs attention"}
          </h1>
          <p>{message}</p>

          {reference ? (
            <p className="checkout-confirm__meta">
              Reference: <strong>{reference}</strong>
            </p>
          ) : null}

          {result?.order ? (
            <div className="checkout-return__summary">
              <span>Order</span>
              <strong>{result.order.orderNumber}</strong>
              <span>Total</span>
              <strong>{formatCurrency(result.order.total)}</strong>
              <span>Status</span>
              <strong>{result.payment.status.replace("_", " ")}</strong>
            </div>
          ) : null}

          <div className="checkout-return__actions">
            <Link to="/shop" className="checkout-confirm__cta">
              Continue shopping
              <HiArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/contact" className="checkout-confirm__secondary">
              Contact Stroane
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutReturn;
