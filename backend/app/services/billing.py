import stripe
from app.config import settings

# Initialize Stripe client
stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_stripe_customer(email: str, name: str = None) -> str:
    """Create a new Stripe customer.

    Args:
        email: Customer email address
        name: Optional customer name

    Returns:
        str: Stripe customer ID
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    customer = stripe.Customer.create(
        email=email,
        name=name,
        metadata={
            "source": "beatscout",
        },
    )

    return customer.id


async def get_stripe_customer(customer_id: str) -> dict:
    """Get Stripe customer by ID."""
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    return stripe.Customer.retrieve(customer_id)


async def create_checkout_session(
    customer_id: str, price_id: str, success_url: str, cancel_url: str
) -> dict:
    """Create a Stripe Checkout session for subscription.

    Args:
        customer_id: Stripe customer ID
        price_id: Stripe Price ID for the subscription
        success_url: URL to redirect after successful payment
        cancel_url: URL to redirect if user cancels

    Returns:
        dict: Checkout session object
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
    )

    return session


async def create_customer_portal_session(customer_id: str, return_url: str) -> dict:
    """Create a customer portal session for managing subscription.

    Args:
        customer_id: Stripe customer ID
        return_url: URL to return after portal session

    Returns:
        dict: Portal session object
    """
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )

    return session


async def get_subscription(subscription_id: str) -> dict:
    """Get subscription details from Stripe."""
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    return stripe.Subscription.retrieve(subscription_id)


async def cancel_subscription(subscription_id: str) -> dict:
    """Cancel a subscription at period end."""
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("Stripe secret key not configured")

    return stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
