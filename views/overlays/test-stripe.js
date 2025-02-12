fetchClientSecret().then((clientSecret) => {
    const stripe = Stripe(
        'pk_test_51OzgG82KJohMNjOSieXVuRBiBI6TFbXkZkWOF4Qsr2H563351MojVy7tE8arnbFbr6zJEPlKA1Nl2H6AZY9cZphg00zG07zi2A',
    );

    const elementStyles = {
        base: {
            fontFamily: 'Roboto',
            fontSize: '15px',
            fontWeight: 'normal',
            '::placeholder': { color: 'transparent' },
        },
        invalid: { color: '#e3342f' },
    };

    const elementClasses = {
        base: 'form-control stripe-input',
        focus: 'form-control-focus',
        invalid: 'is-invalid',
    };

    const elements = stripe.elements({ clientSecret });

    const cardNumber = elements.create('cardNumber', {
        style: elementStyles,
        classes: elementClasses,
        placeholder: '1234 1234 1234 1234',
    });
    const cardExpiry = elements.create('cardExpiry', { style: elementStyles, classes: elementClasses, placeholder: '12 / 34' });
    const cardCvc = elements.create('cardCvc', { style: elementStyles, classes: elementClasses, placeholder: '123' });

    const paymentRequest = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
            label: 'Test Payment',
            amount: 1000,
        },
        requestPayerName: true,
        requestPayerEmail: true,
    });

    paymentRequest.canMakePayment().then((result) => {
        if (!result) {
            $('#expressPaySelector').siblings('label').addClass('rounded-bottom-3');
            $('#expressPaySelector').remove();
            return;
        }

        let paymentMethods = {
            applePay: result.applePay ? 'auto' : 'never',
            googlePay: result.googlePay ? 'auto' : 'never',
        };

        const expressCheckoutElement = elements.create('expressCheckout', {
            paymentMethodOrder: ['apple_pay', 'google_pay'],
            paymentMethods: paymentMethods,
            buttonType: {
                applePay: 'buy',
                googlePay: 'buy',
            },
            buttonTheme: {
                applePay: 'black',
                googlePay: 'black',
            },
            buttonHeight: 55,
        });

        expressCheckoutElement.mount('#express-checkout-element');

        if (result.applePay) {
            $('#expressPaySelector').html('Apply Pay');
        } else if (result.googlePay) {
            $('#expressPaySelector').html('Google Pay');
        } else {
            $('#expressPaySelector').html('Apple / Google Pay');
        }
    });

    cardNumber.mount('#card-number-element');
    cardExpiry.mount('#card-expiry-element');
    cardCvc.mount('#card-cvc-element');

    function showPlaceholder(element) {
        element.update({ style: { base: { '::placeholder': { color: 'lightgrey' } } } });
    }

    function hidePlaceholder(element) {
        element.update({ style: { base: { '::placeholder': { color: 'transparent' } } } });
    }

    function handleFloatingLabel(element, parentSelector) {
        let isFilled = false;
        element.on('focus', function () {
            $(parentSelector).addClass('active');
            $(parentSelector).addClass('typing');
            showPlaceholder(element);
        });

        element.on('blur', function () {
            $(parentSelector).removeClass('typing');
            if (isFilled) {
                return;
            }
            hidePlaceholder(element);
            $(parentSelector).removeClass('active');
        });

        element.on('change', function (event) {
            if (event.empty) {
                isFilled = false;
            } else {
                isFilled = true;
                $(parentSelector).addClass('active');
                showPlaceholder(element);
            }
        });
    }

    handleFloatingLabel(cardNumber, '#card-number-element');
    handleFloatingLabel(cardExpiry, '#card-expiry-element');
    handleFloatingLabel(cardCvc, '#card-cvc-element');

    $('#cardSubmit').on('click', async function (event) {
        event.preventDefault();
        const elem = $(this);
        const currentBtnHtml = $(this).html();
        $(this).html(`
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Processing
                `);
        $('#payment-error').addClass('d-none');

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardNumber,
            },
        });

        if (error) {
            console.log(error);
            $(elem).addClass('bg-danger').html(`<i class="ti ti-credit-card-off me-1"></i> Error!`);
            $('#cardSubmit').popover('dispose');
            $('#cardSubmit')
                .popover({
                    content: `<div class="text-red fw-bold m-0" 
                                    style="border-radius: 4px; padding: 10px;">
                                    ${error.message}
                                  </div>`,
                    placement: 'top',
                    trigger: 'manual',
                    html: true,
                    template: `<div class="popover bg-danger-lt border-0 shadow-md" role="tooltip">
                                    <div class="popover-arrow d-none"></div>
                                    <div class="popover-body p-2"></div>
                                  </div>`,
                })
                .popover('show');

            setTimeout(function () {
                $('#cardSubmit').popover('hide');
                $(elem).removeClass('bg-danger').html(currentBtnHtml);
            }, 6000);
        } else {
            savePaymentInfo();
        }
    });
});


async function fetchClientSecret() {
    const orderId = $('#project-entries').attr('order-id');
    const data = await $.ajax({
        url: `/create-payment-intent/${orderId}/{{data.project.slug}}`,
        type: "POST"
    });
    return data.clientSecret;
}

async function createPaymentMethod() {
    try {
        const { paymentMethod, error } = await stripe.createPaymentMethod({
            type: "card",
            card: {
                number: cardNumberElement,
                expiry: cardExpiryElement,
                cvc: cardCvcElement
            }
        });

        if (error) {
            console.error("Error creating payment method:", error);
        } else {
            console.log("Payment method created:", paymentMethod);
            return paymentMethod;
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}



exports.createDynamicSubscription = async (req, res) => {
    try {
        const { email, firstName, lastName, phone, paymentMethodId } = req.body;

        let customer = await stripe.customers.list({ email });
        customer = customer.data.length
            ? customer.data[0]
            : await stripe.customers.create({ email, name: `${firstName} ${lastName}`, phone });

        // Step 1: Save Payment Method
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: paymentMethodId } });

        // Step 2: Create Subscription with Custom Amount
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [
                {
                    price_data: {
                        currency: 'nok',
                        unit_amount: amount * 100,
                        recurring: { interval: 'month' },
                        product_data: { name: 'Custom Donation' },
                    },
                },
            ],
            expand: ['latest_invoice.payment_intent'],
        });

        res.json({ subscriptionId: subscription.id, status: 'subscription_created' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};