const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utilities/appError');
const globalErrorHandler = require('./controllers/errorController');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.enable('trust proxy');

// Define template engine
app.set('view engine', 'pug');
// Define location for the views directly
app.set('views', path.join(__dirname, 'views'));

//  1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());

app.options('*', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public/index.html'));
// });

// Set security HTTP headers
// app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// Development logging
// make the logging middleware only in the development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//  Limit requests from the same IP In production only

if (process.env.ENVIRONMENT === 'production') {
  // rateLimit is a middleware (function)
  // Allow 100 req from a certain IP in 1hr
  const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, Please try again in an hour',
  });
  // only apply the limiter to routes starts with /api
  app.use('/api', limiter);
}

// this route to which Stripe will automatically send a POST request  to whenever a checkout session has successfully  completed,so basically whenever a payment was successful.
// and stripe will post the session that we created earlier
// We need the body in raw format (stripe function that will read the body needs that) not json so we make that route before the .json middleware (as this middleware convert the body to json format )
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application.json' }),
  bookingController.webhookCheckout
);

// Body parser, reading date from the body into req.body
app.use(
  express.json({
    limit: '18kb',
  })
);
// Cookie parser, reading date from the cookie into req.body
app.use(cookieParser());

// Date sanitization against NoSQL query injection
app.use(mongoSanitize());

// Date sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whiteList: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// COMPRESS ALL THE TEXT SENT TO THE CLIENT
app.use(compression());
// Test Middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// ROUTES

// mounting routes to specific routers
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server `, 404));
});

// Global error handling middleware
// By defining four parameters express know that it is a error handler middleware
app.use(globalErrorHandler);

// Start the server
// in the server.js file

module.exports = app;
