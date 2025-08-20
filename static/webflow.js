initOverlay();
window.variantQuantities = new Map();
window.toastTimers = new Map();
window.maxVisibleToasts = 4; 
window.toastQueue = [];

async function initOverlay() {
    let countryCode = '__COUNTRY_CODE__';
    runGlobal(countryCode);
    await tracker();
}

function runGlobal(countryCode) {
    const $body = $('body');
    const productSlug = $body.attr('productSlug');
    const projectSlug = $body.attr('projectSlug') || $(this).attr('projectSlug');
    const productsOpened = productSlug !== 'random' && productSlug !== '';
    
    if (productsOpened) {
        // attachProductTable(productSlug);
        // initToastSystem()
    }
    
    if (countryCode === 'NO') {
        $('.vipps-number').hide();
        $('.vipps-banner').show();
        runGlobal();
    } else {
        $('.vipps-banner').hide();
    }

    $('.donate').on('click', () => $('.donation-overlay').css({display: 'flex'}));
    
    $('.donate-specific, .qurbani-btn, .orphan-btn, .donate-floods').on('click', function() {
        const buttonProjectSlug = 
            projectSlug || 
            $(this).attr('projectSlug') || 
            ($(this).hasClass('qurbani-btn') ? 'qurbani' : 'orphans-care');
        const elem = $('#donation-overlay').find(`[projectSlug=${buttonProjectSlug}]`);
        showOverlay(elem);
    });

    const processedSlugs = new Set();
    $('.project-selector').each((index, element) => {
        const elementProjectSlug = $(element).attr('projectSlug');
        if (elementProjectSlug && !processedSlugs.has(elementProjectSlug)) {
            processedSlugs.add(elementProjectSlug);
            attachIframe(element, countryCode);
        }
    });

    $('.project-selector').on('click', function() {
        showOverlay($(this));
    });

    initToastSystem();
    initProductButtons();
}


function initToastSystem() {
    if (!$('#toast-container').length) {
       $('body').append(`
            <div id="toast-container" style="
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                z-index: 10000;
                max-width: 350px;
                display: flex;
                flex-direction: column-reverse;
                gap: 12px;
                max-height: 80vh;
                overflow: hidden;
                pointer-events: none;
            "></div>
            <style>
                .cart-toast {
                    background: #FFFFFF;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 300px;
                    position: relative;
                    animation: slideInFromRight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    pointer-events: auto;
                    transition: all 0.3s ease;
                    opacity: 1;
                    transform: translateX(0);
                    border: 1px solid #e9ecef;
                }
                
                .cart-toast.toast-paused {
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                    transform: translateX(-3px);
                }
                
                .cart-toast.removing {
                    animation: slideOutToRight 0.3s ease forwards;
                }
                
                .cart-toast.sliding-out-bottom {
                    animation: slideOutToBottom 0.4s ease forwards;
                }
                
                .cart-toast::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #28a745, #20c997);
                    width: 100%;
                    animation: toastProgress 4s linear;
                    border-radius: 0 0 8px 8px;
                }

                .cart-toast.toast-paused::after {
                    animation-play-state: paused;
                }

                .cart-toast.removing::after,
                .cart-toast.sliding-out-bottom::after {
                    display: none;
                }
                
                .toast-body {
                    padding: 12px;
                }
                
                .toast-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .toast-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: #212529;
                    margin: 0;
                }
                
                .btn-close {
                    background: none;
                    border: none;
                    font-size: 16px;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 0;
                    width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 8px;
                }
                
                .btn-close:hover {
                    color: #000;
                }
                
                .toast-content {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                
                .toast-image {
                    width: 60px;
                    height: 60px;
                    border-radius: 4px;
                    object-fit: cover;
                    flex-shrink: 0;
                }
                
                .toast-image-placeholder {
                    width: 60px;
                    height: 60px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6c757d;
                    font-size: 12px;
                    flex-shrink: 0;
                }
                
                .toast-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .toast-price-name {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-bottom: 8px;
                }
                
                .toast-price {
                    font-size: 14px;
                    color: #6c757d;
                    margin: 0;
                }
                
                .toast-name {
                    font-size: 14px;
                    color: #6c757d;
                    margin: 0;
                }
                
                .toast-attributes {
                    font-size: 12px;
                    color: #6c757d;
                    margin: 0;
                }
                
                .toast-buttons {
                    display: flex;
                    gap: 8px;
                    margin: 0 12px 8px 12px;
                }
                
                .toast-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: center;
                    border: 1px solid #dee2e6;
                    background: #fff;
                    color: #212529;
                }
                
                .toast-btn:hover {
                    background: #f8f9fa;
                    border-color: #adb5bd;
                }

                @media (max-width: 768px) {
                    #toast-container {
                        top: 20px !important;
                        right: 50% !important;
                        transform: translateX(50%) !important;
                        left: auto !important;
                        max-width: calc(100vw - 40px) !important;
                        width: calc(100vw - 40px) !important;
                        flex-direction: column !important;
                    }
                    
                    .cart-toast {
                        min-width: unset !important;
                        width: 100% !important;
                        animation: slideInFromTop 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                    }
                    
                    .cart-toast.removing {
                        animation: slideOutToTop 0.3s ease forwards !important;
                    }
                    
                    .cart-toast.sliding-out-bottom {
                        animation: slideOutToTop 0.4s ease forwards !important;
                    }
                    
                    .cart-toast.toast-paused {
                        transform: translateY(-3px) !important;
                    }
                }
                
                @keyframes slideInFromRight {
                    from { 
                        transform: translateX(100%); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateX(0); 
                        opacity: 1; 
                    }
                }
                
                @keyframes slideOutToRight {
                    from { 
                        transform: translateX(0); 
                        opacity: 1; 
                    }
                    to { 
                        transform: translateX(100%); 
                        opacity: 0; 
                    }
                }
                
                @keyframes slideOutToBottom {
                    from { 
                        transform: translateY(0) scale(1); 
                        opacity: 1; 
                    }
                    to { 
                        transform: translateY(-100%) scale(0.95); 
                        opacity: 0; 
                    }
                }
                
                @keyframes toastProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            </style>
        `);
    }
}

function showToast(message, variantData) {
    const toastId = `toast-${Date.now()}`;
    
    manageToastQueue();
    
    let price = variantData.pricing || '';
    if (price && !price.startsWith('£') && !price.startsWith('$')) {
        price = `${price}`;
    }
    
    const quantityText = variantData.quantity > 1 ? `${variantData.quantity}` : '1';
    
    const imageHtml = variantData.image ? 
        `<img src="${variantData.image}" alt="${variantData.name}" class="toast-image">` : 
        '<div class="toast-image-placeholder">IMG</div>';
    
    const attributes = [];
    if (variantData.size) attributes.push(`Size: ${variantData.size}`);
    attributes.push(`Qty: ${quantityText}`);
    if (variantData.color) attributes.push(variantData.color);
    const attributesText = attributes.join(' | ');
    
    const toast = $(`
        <div class="cart-toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body">
                <div class="toast-header">
                    <strong class="toast-title">Added to Cart</strong>
                    <button type="button" class="btn-close" aria-label="Close">&times;</button>
                </div>
                
                <div class="toast-content">
                    ${imageHtml}
                    
                    <div class="toast-details">
                        <div class="toast-price-name">
                            <span class="toast-price">${price}</span>
                            <span class="toast-name">${variantData.name}</span>
                        </div>
                        
                        <div class="toast-attributes">
                            ${attributesText}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="toast-buttons">
                <button class="toast-btn view-cart-btn">View Cart</button>
            </div>
        </div>
    `);
    
    toast.data('variant', variantData);
    
    window.toastQueue.unshift(toastId);
    $('#toast-container').prepend(toast); 
    
    manageToastTimer(toastId, 'start');
    
    setupToastHoverBehavior(toast, toastId);

    toast.find('.btn-close').on('click', function(e) {
        e.stopPropagation();
        dismissToast(toast, toastId);
    });

    toast.find('.view-cart-btn').on('click', function(e) {
        e.stopPropagation();
        const variant = toast.data('variant');
        
        manageToastTimer(toastId, 'clear');
        const index = window.toastQueue.indexOf(toastId);
        if (index > -1) {
            window.toastQueue.splice(index, 1);
        }
        toast.addClass('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
        
        openProductModalWithVariant(variant);
    });

    toast.on('click', function() {
        const variant = $(this).data('variant');
        
        manageToastTimer(toastId, 'clear');
        const index = window.toastQueue.indexOf(toastId);
        if (index > -1) {
            window.toastQueue.splice(index, 1);
        }
        $(this).addClass('removing');
        setTimeout(() => {
            $(this).remove();
        }, 300);
        
        openProductModalWithVariant(variant);
    });
}

function manageToastQueue() {
    const currentToasts = $('#toast-container .cart-toast').length;
    
    if (currentToasts >= window.maxVisibleToasts) {
        const toastsToRemove = currentToasts - window.maxVisibleToasts + 1;
        
        for (let i = 0; i < toastsToRemove; i++) {
            const oldestToastId = window.toastQueue.pop();
            if (oldestToastId) {
                const oldestToast = $(`#${oldestToastId}`);
                if (oldestToast.length) {
                    slideOutToast(oldestToast, oldestToastId);
                }
            }
        }
    }
}

function slideOutToast(toast, toastId) {
    manageToastTimer(toastId, 'clear');
    
    const variantData = toast.data('variant');
    if (variantData && variantData.id) {
        const currentQty = window.variantQuantities.get(variantData.id) || 0;
        const newQty = Math.max(0, currentQty - 1);
        window.variantQuantities.set(variantData.id, newQty);
        
        const $button = $(`.product-btn[data-id="${variantData.id}"]`);
        if ($button.length) {
            updateButtonVisual($button, newQty);
        }
    }
    
    toast.addClass('sliding-out-bottom');
    setTimeout(() => {
        toast.remove();
        const index = window.toastQueue.indexOf(toastId);
        if (index > -1) {
            window.toastQueue.splice(index, 1);
        }
    }, 400);
}


function dismissToast(toast, toastId) {
    manageToastTimer(toastId, 'clear');
    
    const index = window.toastQueue.indexOf(toastId);
    if (index > -1) {
        window.toastQueue.splice(index, 1);
    }
    
    const variantData = toast.data('variant');
    if (variantData && variantData.id) {
        const currentQty = window.variantQuantities.get(variantData.id) || 0;
        const newQty = Math.max(0, currentQty - 1);
        window.variantQuantities.set(variantData.id, newQty);
        
        const $button = $(`.product-btn[data-id="${variantData.id}"]`);
        if ($button.length) {
            updateButtonVisual($button, newQty);
        }
    }
    
    toast.addClass('removing');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

function manageToastTimer(toastId, action, delay = 4000) {
    if (window.toastTimers.has(toastId)) {
        clearTimeout(window.toastTimers.get(toastId));
        window.toastTimers.delete(toastId);
    }
    
    if (action === 'start') {
        const timerId = setTimeout(() => {
            const toast = $(`#${toastId}`);
            if (toast.length) {
                dismissToast(toast, toastId);
            }
        }, delay);
        
        window.toastTimers.set(toastId, timerId);
    }
}

function setupToastHoverBehavior(toast, toastId) {
    toast.on('mouseenter', function() {
        manageToastTimer(toastId, 'clear');
        $(this).addClass('toast-paused');
    });
    
    toast.on('mouseleave', function() {
        manageToastTimer(toastId, 'start', 4000); 
        $(this).removeClass('toast-paused');
    });
}


function initProductButtons() {
    $(document).off('click', '.product-btn');

    if ($('.product-btn').length === 0) {
        console.log(' system');
        return;
    }
    
    $(document).off('click', '.product-btn');
    
    $(document).on('click', '.product-btn', function(e) {
        e.preventDefault();
        
        const $button = $(this);
        if ($button.hasClass('processing')) return;
        
        $button.addClass('processing');
        
        const variantId = $(this).data('id');
        const variantName = $(this).text().trim();
        const projectSlug = $('body').attr('productSlug');

        const pricingSpan = $(this).find('.pricing');
        const pricing = pricingSpan.length ? pricingSpan.text().trim() : '';

        const currentQty = window.variantQuantities.get(variantId) || 0;
        const newQty = currentQty + 1;
        window.variantQuantities.set(variantId, newQty);

        updateButtonVisual($button, newQty);

        const variantData = {
            id: variantId,
            name: variantName.replace(pricing, '').trim(),
            pricing: pricing,
            projectSlug: projectSlug,
            quantity: newQty
        };

        showToast(`Added ${variantData.name} to cart${newQty > 1 ? ` (${newQty})` : ''}`, variantData);
        
        setTimeout(() => $button.removeClass('processing'), 500);
    });
}

function openProductModalWithVariant(variantData) {
    const projectSlug = variantData.projectSlug;
    const elem = $(`[projectSlug="${projectSlug}"]`).first();
    
    console.log('Opening modal with variant:', variantData);
    console.log('Found element:', elem.length);
    
    if (elem.length) {
        window.pendingVariant = variantData;
        
        showOverlay(elem);
        
        const iframe = $(`#iframe-${projectSlug}`)[0];
        if (iframe) {
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                sendVariantToIframe(iframe, variantData, projectSlug);
            } else {
                let messageSent = false;
                const checkIframeReady = () => {
                    if (!messageSent && iframe.contentWindow) {
                        messageSent = true;
                        sendVariantToIframe(iframe, variantData, projectSlug);
                    }
                };
                
                setTimeout(checkIframeReady, 1000);
            }
        }
    }
}

function sendVariantToIframe(iframe, variantData, projectSlug) {
    const message = {
        action: 'addVariantToOrder',
        variantId: variantData.id,
        projectSlug: projectSlug,
        variant: variantData
    };
    
    console.log('Sending message to iframe:', message);
    
    try {
        iframe.contentWindow.postMessage(message, '*');
        
        const iframeOrigin = new URL(iframe.src).origin;
        iframe.contentWindow.postMessage(message, iframeOrigin);
        console.log('Sent to specific origin:', iframeOrigin);
    } catch (e) {
        console.log('Error sending message to iframe:', e);
    }
}

function attachIframe(elem, code) {
    const partnerPortal = $(elem).attr('partnerSlug');
    if (partnerPortal) return;

    const slug = encodeURIComponent($(elem).attr('projectSlug'));
    const products = encodeURIComponent($(elem).attr('projectProducts'));
    const name = encodeURIComponent($(elem).attr('projectName'));
    const hdg = encodeURIComponent($(elem).attr('projectHeading'));
    const cover = encodeURIComponent($(elem).siblings('img').attr('src'));
    const desc = encodeURIComponent($(elem).siblings('.project-desc').html());
    
    let url;
    if (products === 'random') {
        url = `__CUSTOMER_PORTAL_URL__/overlay/${slug}?name=${name}&heading=${hdg}&cover=${cover}&description=${desc}&countryCode=${code}&webflow=true&products=${products}`;
    }

    const allowedProducts = ['qurbani', 'water-pakistan', 'emergency-pak-flood-appeal-2025'];
    if (allowedProducts.includes(products)) {
        url = `__CUSTOMER_PORTAL_URL__/overlay/${slug}?countryCode=${code}&webflow=true&products=${products}`;
    }

    const $iframe = $(`<iframe id="iframe-${slug}" allow="payment"></iframe>`)
        .attr('src', url)
        .css({
            display: 'none', margin: '0', padding: '0', border: '0',
            width: '100%', height: '100%', position: 'fixed', opacity: 1,
            top: '0', left: '0', right: '0', bottom: '0',
            transform: 'translateZ(100px)', 'z-index': '9999'
        });

    $('body').append($iframe);
}

function showOverlay(elem) {
    const slug = $(elem).attr('partnerSlug') || $(elem).attr('projectSlug');
    const $iframe = $(`#iframe-${slug}`);
    
    console.log(elem, slug);

    $iframe[0].contentWindow.postMessage('goingVisible', '*');
    
    $('#iframe-loading-overlay').remove();

    const $loadingOverlay = $('<div id="iframe-loading-overlay"></div>').css({
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)', opacity: 0, zIndex: '9998',
        color: 'white', display: 'flex', 'align-items': 'center', 'justify-content': 'center'
    });

    const showLoadingOverlay = () => {
        $loadingOverlay.stop().animate({opacity: 1}, 300);
        $iframe.css({display: 'block'});
    };

    const hideLoadingOverlay = () => {
        $iframe.css({display: 'none'});
        $loadingOverlay.stop().fadeOut(300, () => $loadingOverlay.remove());
    };

    $('body').append($loadingOverlay);
    showLoadingOverlay();
    $('body').css({overflow: 'hidden', height: '100vh'});

    $(window).off('message.overlay').on('message.overlay', function(event) {
        if (event.originalEvent.data === 'close-overlay') {
            $('body').css({overflow: 'scroll', height: 'auto'});
            hideLoadingOverlay();
        }
    });
}

async function tracker() {
    const params = new URLSearchParams(window.location.search);
    const utm = {
        source: params.get('utm_source'), medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'), term: params.get('utm_term'),
        content: params.get('utm_content')
    };

    const data = {
        referrer: document.referrer || null, fullUrl: window.location.href,
        hostname: window.location.hostname, path: window.location.pathname,
        utm: Object.fromEntries(new URLSearchParams(window.location.search)),
        language: navigator.language, userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {width: window.innerWidth, height: window.innerHeight},
        platform: navigator.platform, utm
    };

    $.ajax({
        url: '__CUSTOMER_PORTAL_URL__/widget-loader',
        type: 'POST', data,
        success: (response) => {}, 
        error: (error) => console.error(error)
    });
}


function updateButtonVisual($button, quantity) {
    $button.find('.quantity-indicator, .tick-indicator').remove();
    
    if (quantity === 0) {
        return;
    } else if (quantity === 1) {
        $button.append(`
            <span class="tick-indicator" style="margin-left: 6px; color: #28a745; font-weight: bold;">✓</span>
        `);
    } else if (quantity > 1) {
        $button.append(`
            <span class="quantity-indicator" style="
                margin-left: 6px; 
                background: #28a745; 
                color: white; 
                border-radius: 50%; 
                width: 18px; 
                height: 18px; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 0.7rem; 
                font-weight: bold;
            ">${quantity}</span>
        `);
    }
}

function attachProductTable(page) {
    $('body').prepend(`
        <style>
            button.product-btn {
                display: flex; align-items: center;
                background-color: var(--base-color-brand--orange);
                color: var(--base-color-neutral--white);
                text-align: center; border-radius: 1.5rem; padding: 13px 14px;
                font-size: 1rem; font-weight: 900; line-height: 0;
                text-decoration: none; margin-bottom: 4px; height: fit-content;
                cursor: pointer; border: none; transition: all 0.2s ease;
                position: relative;
            }
            button.product-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
            button.product-btn.processing { opacity: 0.7; cursor: not-allowed; }
            button.product-btn > svg { margin-right: 2px; margin-left: -2px; }
            button.product-btn > .pricing { font-size: 0.6rem; padding-left: 4px; }
            button.product-btn .tick-indicator {
                animation: tickPulse 0.3s ease;
            }
            button.product-btn .quantity-indicator {
                animation: quantityPulse 0.3s ease;
            }
            @keyframes tickPulse {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes quantityPulse {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
        </style>
    `);

    const attachProducts = (order) => {
        for (const product of order.products) {
            const wrapper = $(`#${product.id}`);
            const btns = product.variants.map(variant => `
                <button class="product-btn" data-id="${variant.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 5l0 14" />
                        <path d="M5 12l14 0" />
                    </svg>
                    ${variant.name} 
                    <span class="pricing">${variant.price} ${order.currency}</span>
                </button>
            `).join('');
            wrapper.html(btns);
        }
    };

    $(window).off('message.products').on('message.products', function(event) {
        const e = event.originalEvent;
        if (e.data?.products) {
            const order = e.data;
            const iframes = document.getElementsByTagName('iframe');
            for (const iframe of iframes) {
                if (iframe.contentWindow === e.source) {
                    console.log('Message from iframe:', iframe);
                    break;
                }
            }

            attachProducts(order);
        }
    });
}

$(window).off('message.webflow').on('message.webflow', function(event) {
    const e = event.originalEvent;
    const data = e.data;
    
    console.log('Received message in webflow:', data, 'from origin:', e.origin);
    
    if (data === 'iframe-ready') {
        console.log('Iframe is ready for communication');
        
        if (window.pendingVariant && !window.variantMessageSent) {
            window.variantMessageSent = true; 
            
            setTimeout(() => {
                const iframe = document.querySelector(`#iframe-${window.pendingVariant.projectSlug}`);
                if (iframe && iframe.contentWindow) {
                    sendVariantToIframe(iframe, window.pendingVariant, window.pendingVariant.projectSlug);
                }
            }, 100);
        }
    }
    
    if (data?.action === 'variantAdditionComplete') {
        console.log('Variant addition confirmed by iframe:', data);
        window.pendingVariant = null; 
        window.variantMessageSent = false; 
    }
    
    if (data?.action === 'requestVariantAddition') {
        const { variantId, projectSlug } = data;
        console.log(`Iframe requesting variant addition: ${variantId} for project ${projectSlug}`);
    }
});