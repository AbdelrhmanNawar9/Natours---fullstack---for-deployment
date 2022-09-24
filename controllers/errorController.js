const AppError = require('../utilities/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const { name } = err.keyValue;
  let message = '';
  if (!name) {
    message = `A tour with the same name is already exist!`;
  } else {
    message = `Duplicate field value: '${name}'. Please use another value!`;
  }
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const { message } = err;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again', 401);
const handleJWTExpiredError = () =>
  new AppError('Your token is expired! Please log in again', 401);

const sendErrorDev = (err, res, req) => {
  //  A- for APi
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // B- Rendered  website
  console.log('Error 😩', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const sendErrorProd = (err, res, req) => {
  //  A- for APi
  if (req.originalUrl.startsWith('/api')) {
    // A-1
    // Operational, trusted error, send message to the client
    if (err.isOperational) {
      console.log('Error 😩 ', err);
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // A-2
    // Programming or unknown error don't leak error details
    // 1) log the error
    console.log('Error 😩 ', err);
    // 2) Send a generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong',
    });
  }

  // B- Rendered  website
  // B-1 Operational, trusted error, render message to the client
  if (err.isOperational) {
    console.log('Error 😩a', err);
    return res.status(err.statusCode).render('error', {
      title: 'Something went very wrong!',
      msg: err.message,
    });
  }
  //  B-2 Programming or unknown error don't leak error details , render a defined message by us
  // 1) log the error
  console.log('Error 😩', err);
  // 2) Send a generic message
  return res.status(500).render('error', {
    title: 'Something went very wrong',
    msg: 'Please try again later.',
  });
};

// This is a Global error handler middleware
module.exports = (err, req, res, next) => {
  // Defining default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res, req);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    // eslint-disable-next-line prefer-object-spread
    // let error = Object.assign({}, err);
    // To transform the castError to AppError to have err.isOperational: true
    if (err.name === 'CastError') {
      error = handleCastErrorDB(err);
    }
    if (error.code === 11000) {
      error = handleDuplicateFieldsDB(error);
    }
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }
    sendErrorProd(err, res, req);
  }
};
