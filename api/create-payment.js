import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Create a PaymentIntent for ¥9980/month subscription
        // For demo, we'll do a one-time payment first
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 998000, // ¥9,980 in cents (Stripe uses smallest currency unit)
            currency: 'jpy',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                product: 'Calculator Pro',
                type: 'subscription_first_payment',
            },
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Stripe error:', error);
        return res.status(500).json({ error: '決済の準備に失敗しました' });
    }
}
