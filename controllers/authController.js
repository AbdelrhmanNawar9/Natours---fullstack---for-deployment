const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utilities/catchAsync');
const AppError = require('../utilities/appError');
const Email = require('../utilities/email');

const signToken = (id) =>
  // Creating the token (payload,secret,options)
  jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  // Creating the token (payload,secret,options)
  const token = signToken(user._id);

  const cookieOptions = {
    // the client will delete the cookie after it is expired
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),

    // the cookie cannot be accessed or modified by any way by the browser
    httpOnly: true,
  };
  // Send the cookie only on an encrypted connection(HTTPS) only in production
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);

  // To not show the password in the response (even if it is encrypted)
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // const newUser = await User.create(req.body);
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });
  // 'http://127.0.0.1:3000/me'
  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  console.log({ reqbody: req.body });
  const { email, password } = req.body;
  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  // 2) Check if email and password correct
  const user = await User.findOne({ email: email }).select('+password');
  // console.log(user);
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get the token and check if it is there
  let token = '';
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access!', 401)
    );
  }
  // 2) Verification the token(check if someone manipulated the data or the token had expired)
  // verify will return the decoded payload if signature is valid else will return an error
  // jwt.verify is callback-based function. But promises are more convenient here because we used this pattern in our code, so it makes sense to promisify them.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if the user  still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist!',
        401
      )
    );
  }
  // 4) Check if user change password after the token was issued
  // iat is the timestamp for the token creation time (token issued)
  if (currentUser.changePasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// This middleware will not protect any route, So errors will never be in this middleware
// This middleware is to check if a user is logged in or not (but it will let the user access its destination anyway)
// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
  try {
    // 1) Get the token via cookies
    if (!req.cookies.jwt) return next();

    // 2) Verify the token from the cookie
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );

    // 3) Check if the user  still exist
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next();
    }
    // 4) Check if user change password after the token was issued

    if (currentUser.changePasswordAfter(decoded.iat)) {
      return next();
    }

    // There is a logged in user
    // Make the user available in templates
    res.locals.user = currentUser;
    next();
  } catch (err) {
    next();
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    status: 'success',
  });
};

//  We did so so that we can pass a parameter to a middleware function
// because of closures the inner function will have access to ...roles
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    //  Roles is an array ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Your do not have permission to perform this action', 403)
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }
  // 2) Generate the random token in the user
  const resetToken = user.createPasswordResetToken();

  // Save the user without validation
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    // await sendEmail({
    //   email: req.body.email,
    //   subject: 'Your password reset token (valid for 10 min)',
    //   message,
    // });
    await new Email(user, resetURL).sendPasswordReset();
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // console.log({ err });
    return next(
      new AppError(
        `There was an error sending the email. Try again later!`,
        500
      )
    );
  }

  res.status(200).json({ status: 'success', message: `Token send to email!` });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) if token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  // 3) Update changePasswordAt property for the user

  await user.save();

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will not work (save event middlewares and password confirm validation will Not work )

  // 4) Log user in, send JWT (because password has just been updated)
  createSendToken(user, 200, res);
});
