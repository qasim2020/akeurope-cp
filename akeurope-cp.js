const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('./config/db');
const exphbs = require('express-handlebars');
const path = require('path');
const hbsHelpers = require('./modules/helpers');
const MongoStore = require('connect-mongo');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

require('dotenv').config();
mongoose();

const app = express();
app.engine('handlebars', exphbs.engine({helpers: hbsHelpers}));
app.set('view engine', 'handlebars');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, 
      collectionName: 'sessions_customer_portal',    
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, 
    }
  })
);

app.use(flash());

app.use('/tabler', express.static(path.join(__dirname, 'node_modules', '@tabler', 'core', 'dist')));

app.use('/static', express.static(path.join(__dirname, 'static')));

app.use(authRoutes);
app.use(dashboardRoutes);


// Home route
app.get('/', (req, res) => {
  res.redirect('/login');
});

const PORT = 3009;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));