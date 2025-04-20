const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('./config/db');
const exphbs = require('express-handlebars');
const path = require('path');
const hbsHelpers = require('./modules/helpers');
const MongoStore = require('connect-mongo');
const { sendErrorToTelegram, notifyTelegramStripe } = require('./modules/telegramBot');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const orderRoutes = require('./routes/ordersRoutes');
const entryRoutes = require('./routes/entryRoutes');
const customerRoutes = require('./routes/customerRoutes');
const filesRoutes = require('./routes/filesRoutes');
const widgetRoutes = require('./routes/widgetRoutes');
const overlayRoutes = require('./routes/overlayRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const { sendThankYouMessage } = require('./modules/emails');
const { downloadStripeInvoiceAndReceipt } = require('./modules/invoice');
const vippsRoutes = require('./routes/vippsRoutes');
const { captureVippsPayment } = require('./modules/vippsModules');

require('dotenv').config();
mongoose();

const app = express();

app.engine('handlebars', exphbs.engine({ helpers: hbsHelpers }));
app.set('view engine', 'handlebars');

app.use(express.urlencoded({ extended: true }));

app.use('/webhook', express.raw({ type: 'application/json' }), notifyTelegramStripe, stripeRoutes);
app.use('/webhooks', express.raw({ type: 'application/json' }), notifyTelegramStripe, stripeRoutes);

app.use(express.json());

app.use(
    session({
        name: 'akeurope-cp-id',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions_customer_portal',
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24,
        },
    }),
);

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    console.log(req.originalUrl);
    let oldSend = res.send;
    let oldJson = res.json;

    let responseBody;

    res.send = function (data) {
        responseBody = data;
        return oldSend.apply(res, arguments);
    };

    res.json = function (data) {
        responseBody = data;
        return oldJson.apply(res, arguments);
    };

    const forbiddenErrors = ['/overlay/fonts/Karla-regular.woff', '/robots.txt'];

    res.on('finish', () => {
        if (res.statusCode > 399 && !forbiddenErrors.includes(req.originalUrl)) {
            const errorData = {
                message: responseBody,
                status: res.statusCode,
                url: req.originalUrl,
            };

            console.log(responseBody);
            sendErrorToTelegram(errorData);
        }
    });

    next();
});

app.use(flash());

app.use('/tabler', express.static(path.join(__dirname, 'node_modules', '@tabler', 'core', 'dist')));

app.use('/static', express.static(path.join(__dirname, 'static')));

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(onboardingRoutes);
app.use(invoiceRoutes);
app.use(entryRoutes);
app.use(orderRoutes);
app.use(customerRoutes);
app.use(filesRoutes);
app.use(widgetRoutes);
app.use(overlayRoutes);
app.use(vippsRoutes);

app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', '.well-known', 'apple-developer-merchantid-domain-association'));
});

// app.get('/preview-email', async (req, res) => {
//     const templateName = 'invoiceRenewel';
//     const data = {
//         name: 'Hassam Bukhari',
//         invoiceNreceipt: true,
//         newUser: false,
//         invoiceUrl: '123',
//         receiptUrl: '123',
//         portalUrl: '123'
//     };
//     res.render(`emails/${templateName}`, data);
// });

// app.get('/testing/:orderId', async (req, res) => {
//     try {
//         const { updateOrderMonthsVsVippsCharges } = require('./modules/orders');
//         const orderId = req.params.orderId;
//         await updateOrderMonthsVsVippsCharges(orderId);
//         res.status(200).send('Done');
//     } catch (error) {
//         console.log(error);
//         res.status(400).send(error);
//     }
// });

app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/error-test', (req, res) => {
    res.status(500).send('This is an error');
});

const PORT = 3009;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
