const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name!'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email!'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email!'],
    },
    photo: { type: String, default: 'default.jpg' },
    role: {
      type: String,
      enum: {
        values: ['user', 'guide', 'lead-guide', 'admin'],
      },
      default: 'user',
    },

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minLength: [8, 'Password must has at least 8 characters'],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        // This only works on save !! (when we create a new document) .save or .create
        validator: function (el) {
          return el === this.password;
        },
        message: `Password and passwordConfirm are not the same!`,
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: { type: Boolean, default: true, select: false },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // validateBeforeSave: true,
  }
);

// Password encryption
userSchema.pre('save', async function (next) {
  // Only run this function if password is actually modified
  // as we don't want to encrypt the password over and over again whenever we save a user
  if (!this.isModified('password')) return next();

  // hash is a async version (will return a promise )because we don't want to block the event loop and prevent other users
  // hash the password with the cost of 12
  // the higher the cost the stronger the password (will take longer time ) and will be with larger length but 12 is ok
  this.password = await bcrypt.hash(this.password, 12);
  // console.log(this.password);
  // Delete passwordConfirm field as we don't need it anymore
  this.passwordConfirm = undefined;

  next();
});

userSchema.pre('save', async function (next) {
  //  Don't update passwordChangedAt property for newly created user
  if (!this.isModified('password') || this.isNew) return next();

  // we subtract a 1000 ms because assigning to DB may take some time(1 second)
  // and that may cause that the JWTTimestamp is before changedAtTimestamp  for the token in authController the line from saving as saving (may take some time)
  // now if we try to use that token
  // that may cause the following
  // changePasswordAfter function may be return a wrong true then the protect function will return error (User recently changed password! Please log in again)

  // so we subtract 1000ms to make sure that in resetPassword controller in authController the created token its JWTTimestamp is after changedAtTimestamp (from save middleware)
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, async function (next) {
  // This point to the current query
  this.find({ active: { $ne: false } });
  next();
});

// instance method is a method that will be available on all documents from a certain collection
// instance method
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // will return true or false
  // compare will encrypt the candidatePassword and compare it to userPassword (which is in encrypted in DB)
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // getting time in ms
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    // console.log(this.passwordChangedAt, JWTTimestamp);
    return changedTimestamp > JWTTimestamp;
  }

  // False means not changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // The password reset token should basically be a random string but at the same time, it doesn't need to be as cryptographically strong as the password hash that we created before. We can just use the very simple, random bytes function from the built-in crypto module.
  const resetToken = crypto.randomBytes(32).toString('hex');

  // This keyword refer to the document
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Create an expiration duration in millisecond
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
