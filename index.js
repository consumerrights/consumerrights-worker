import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Initialize Stripe with fetch-based HTTP client
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Create checkout session endpoint
    if (url.pathname === '/api/create-checkout' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { templateId, templateName, price } = body;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'aud',
                product_data: {
                  name: templateName,
                  description: 'Australian Consumer Rights Template Letter',
                },
                unit_amount: Math.round(price * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${url.origin}/success.html?session_id={CHECKOUT_SESSION_ID}&template=${templateId}`,
          cancel_url: `${url.origin}/#templates`,
          metadata: {
            templateId: templateId,
          },
        });

        return new Response(JSON.stringify({ 
          sessionId: session.id, 
          url: session.url 
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('Checkout error:', error);
        return new Response(JSON.stringify({ 
          error: error.message 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Verify payment and allow download
    if (url.pathname === '/api/verify-payment' && request.method === 'GET') {
      try {
        const sessionId = url.searchParams.get('session_id');
        
        if (!sessionId) {
          return new Response(JSON.stringify({ 
            error: 'Missing session_id parameter' 
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*' 
            },
          });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid') {
          return new Response(JSON.stringify({
            paid: true,
            templateId: session.metadata.templateId,
            customerEmail: session.customer_details?.email,
            amount: session.amount_total / 100,
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*' 
            },
          });
        } else {
          return new Response(JSON.stringify({ 
            paid: false,
            status: session.payment_status 
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*' 
            },
          });
        }
      } catch (error) {
        console.error('Verification error:', error);
        return new Response(JSON.stringify({ 
          error: error.message 
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          },
        });
      }
    }

    // 404 for unmatched routes
    return new Response('Not Found', { status: 404 });
  },
};
