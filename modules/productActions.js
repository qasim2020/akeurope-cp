const path = require('path');
const fs = require('fs').promises;
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const { generatePagination } = require('../modules/generatePagination');
const { getCurrencyRates } = require('./getCurrencyRates');
const { saveLog } = require('./logAction');
const { logTemplates } = require('./logTemplates');
const { getVippsSubscriptionsByOrderId } = require('../modules/vippsPartner');
const { roundToNearest } = require('../modules/helpers');

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // swap
    }
    return array;
}

async function changeProductsCurrency(products, newCurrency, baseCurrency) {
    const currencyRates = await getCurrencyRates(newCurrency);
    const currencyRate = parseFloat(currencyRates.rates[baseCurrency].toFixed(2));

    const productList = products.map((val) => {
        const convertedPrices = val.variants?.map((variant) => {
            return { ...variant, 
                price: parseFloat(variant.price / currencyRate).toFixed(2),
             };
        });
        return { ...val, variants: convertedPrices };
    });
    return productList;
}

async function getProjectProducts(slug, code) {
    const filePath = path.join(__dirname, '../products.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const project = data[slug];
    if (!project) throw new Error('Products not listed in json file');
    const baseCurrency = project.currency;
    const products = project.products;
    const productList = await changeProductsCurrency(products, code, baseCurrency);
    return productList;
}

const randomlySelectAProduct = (products) => {
    const shuffledProductsList = shuffleArray(products);
    let cost = 0;
    const productAddedToOrder = shuffledProductsList.map((category, index) => {
        const variants = category.variants.map((product, indexInner) => {
            let orderedCost = 0,
                quantity = 0;
            if (index === 0 && indexInner === 0) {
                orderedCost = product.price;
                cost = product.price;
                quantity = 1;
            }
            return { ...product, orderedCost, quantity };
        });
        const orderedCost = variants.reduce((total, variant) => total + variant.orderedCost * variant.quantity, 0);
        const totalVariantsSelected = variants.reduce((total, variant) => {
            if (variant.orderedCost > 0) {
                return total + 1;
            }
            return total;
        }, 0);
        return {
            ...category,
            variants,
            quantity: totalVariantsSelected,
            orderedCost: orderedCost,
        };
    });
    return { products: productAddedToOrder, cost };
};

const makeProductOrder = async (currency, country, slug) => {
    const products = await getProjectProducts(slug, currency);
    const { products: productsWithSelection, cost } = randomlySelectAProduct(products);
    let order = new Subscription({
        customerId: process.env.TEMP_CUSTOMER_ID,
        currency: currency,
        total: cost,
        totalAllTime: cost,
        monthlySubscription: false,
        countryCode: country.code,
        projectSlug: slug,
        products: productsWithSelection,
        status: 'draft',
    });
    await order.save();
    order = order.toObject();
    return order;
};

const calculateProductOrder = async (orderId) => {
    const order = await Subscription.findById(orderId).lean();

    const updatedProducts = order.products?.map((category) => {
        let quantity = 0;
        const updatedVariants = category.variants.map((variant) => {
            const orderedCost = variant.price * variant.quantity;
            quantity += variant.quantity;
            return {
                ...variant,
                orderedCost,
            };
        });

        const categoryOrderedCost = updatedVariants.reduce((total, variant) => total + variant.orderedCost, 0);

        return {
            ...category,
            quantity,
            variants: updatedVariants,
            orderedCost: categoryOrderedCost,
        };
    });

    const totalSum = updatedProducts.reduce((total, category) => total + category.orderedCost, 0);

    await Subscription.updateOne(
        { _id: order._id },
        {
            $set: {
                products: updatedProducts,
                total: totalSum,
                totalAllTime: totalSum,
            },
        },
    );
};

const incrementVariantToProductOrder = async (orderId, variantId) => {
    const order = await Subscription.findById(orderId).lean();
    const variants = order.products.flatMap((product) => product.variants.filter((variant) => variant.id === variantId));
    if (variants.length === 0) throw new Error('Variant not found in products');
    const variant = variants[0];
    const updatedQuantity = variant.quantity + 1;
    const newCost = variant.price * updatedQuantity;
    const updatedVariant = {
        ...variant,
        quantity: updatedQuantity,
        orderedCost: newCost,
    };
    await Subscription.updateOne(
        {
            _id: order._id,
            'products.variants.id': updatedVariant.id,
        },
        {
            $set: {
                'products.$[p].variants.$[v]': updatedVariant,
            },
        },
        {
            arrayFilters: [{ 'p.variants.id': updatedVariant.id }, { 'v.id': updatedVariant.id }],
        },
    );
};


const decrementVariantToProductOrder = async (orderId, variantId) => {
    const order = await Subscription.findById(orderId).lean();
    const variants = order.products.flatMap((product) => product.variants.filter((variant) => variant.id === variantId));
    if (variants.length === 0) throw new Error('Variant not found in products');
    const variant = variants[0];
    if (variant.quantity <= 0) throw new Error('Cannot decrement quantity below 1');
    const updatedQuantity = variant.quantity - 1;
    const newCost = variant.price * updatedQuantity;
    const updatedVariant = {
        ...variant,
        quantity: updatedQuantity,
        orderedCost: newCost,
    };
    await Subscription.updateOne(
        {
            _id: order._id,
            'products.variants.id': updatedVariant.id,
        },
        {
            $set: {
                'products.$[p].variants.$[v]': updatedVariant,
            },
        },
        {
            arrayFilters: [{ 'p.variants.id': updatedVariant.id }, { 'v.id': updatedVariant.id }],
        },
    );
};

const removeVariantInProductOrder = async (orderId, variantId) => {
    const order = await Subscription.findById(orderId).lean();
    const variants = order.products.flatMap((product) => product.variants.filter((variant) => variant.id === variantId));
    if (variants.length === 0) throw new Error('Variant not found in products');
    const variant = variants[0];
    const updatedQuantity = 0;
    const newCost = variant.price * updatedQuantity;
    const updatedVariant = {
        ...variant,
        quantity: updatedQuantity,
        orderedCost: newCost,
    };
    await Subscription.updateOne(
        {
            _id: order._id,
            'products.variants.id': updatedVariant.id,
        },
        {
            $set: {
                'products.$[p].variants.$[v]': updatedVariant,
            },
        },
        {
            arrayFilters: [{ 'p.variants.id': updatedVariant.id }, { 'v.id': updatedVariant.id }],
        },
    );
};

const findProjectInFile = async (slug) => {
    const filePath = path.join(__dirname, '../products.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const project = data[slug];
    if (!project) throw new Error('Products not listed in json file');
    return project;
};

const changeProductOrderCurrency = async (newCurrency, orderId) => {
    const order = await Subscription.findById(orderId).lean();
    const project = await findProjectInFile(order.projectSlug);
    if (order.currency === newCurrency) 
        throw new Error(`Cannot change currency to same currency in ${order._id} - from ${project.currency} to ${order.currency} - why calling this function`);
    const baseCurrency = project.currency;
    const products = project.products;
    const productList = await changeProductsCurrency(products, newCurrency, baseCurrency);
    for (const product of productList) {
        for (const variant of product.variants) {
            await Subscription.updateOne(
                {
                    _id: order._id,
                    'products.variants.id': variant.id,
                },
                {
                    $set: {
                        'products.$[p].variants.$[v].price': variant.price,
                    },
                },
                {
                    arrayFilters: [
                        { 'p.variants.id': variant.id },
                        { 'v.id': variant.id },
                    ],
                }
            );
        }
    }
    await Subscription.updateOne(
        { _id: order._id },
        {
            $set: {
                currency: newCurrency,
            },
        }
    );
};

const removeUnorderedProducts = async (orderId) => {
    const order = await Subscription.findById(orderId).lean();
    const products = order.products.filter((product) => {
        if (product.orderedCost > 0) {
            product.variants = product.variants.filter((variant) => variant.orderedCost > 0);
            return true;
        }
        return false;
    });
    const updatedOrder = {
        ...order,
        products,
    };
    await Subscription.updateOne(
        { _id: order._id },
        {
            $set: {
                products: updatedOrder.products,
            },
        }
    );
};

module.exports = {
    makeProductOrder,
    calculateProductOrder,
    findProjectInFile,
    incrementVariantToProductOrder,
    decrementVariantToProductOrder,
    removeVariantInProductOrder,
    changeProductOrderCurrency,
    removeUnorderedProducts
};
