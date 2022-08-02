const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const cookieParser = require('cookie-parser');
const AppError = require('./utilities/appError');
const globalErrorHandler = require('./controllers/errorController');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

// Define template engine
app.set('view engine', 'pug');
// Define location for the views directly
app.set('views', path.join(__dirname, 'views'));

//  1) GLOBAL MIDDLEWARES
// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet());

// Development logging
// make the logging middleware only in the development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//  Limit requests from the same IP
// rateLimit is a middleware (function)
// Allow 100 req from a certain IP in 1hr
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, Please try again in an hour',
});
// only apply the limiter to routes starts with /api
app.use('/api', limiter);

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
