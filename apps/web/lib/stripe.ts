// Razorpay integration for payments
// This module provides utilities for initializing Razorpay checkout

export const razorpayConfig = {
  keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
};

export interface RazorpayOptions {
  key: string;
  order_id: string;
  name?: string;
  description?: string;
  amount?: number;
  currency?: string;
  email?: string;
  contact?: string;
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: {
    ondismiss: () => void;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature?: string;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(window.Razorpay);
    };
    document.body.appendChild(script);
  });
};

export const initializeRazorpayCheckout = (options: RazorpayOptions) => {
  if (!window.Razorpay) {
    throw new Error('Razorpay not loaded');
  }
  
  const razorpay = new window.Razorpay(options);
  razorpay.open();
  return razorpay;
};