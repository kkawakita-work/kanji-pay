import { loadStripe } from '@stripe/stripe-js'

// Stripe Promise singleton
let stripePromise: Promise<any> | null = null

export const getStripe = () => {
  if (!stripePromise) {
    // Retrieve Stripe Publishable Key from env variables.
    // Fallback uses the matching account ID prefix from shukin-api's Secret Key (51TaNbLDwbTcUOVt8)
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51TaNbLDwbTcUOVt8pX5tT9wQ'
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
