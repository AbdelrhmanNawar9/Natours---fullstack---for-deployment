const multer = require('multer');
const jimp = require('jimp');
const fs = require('fs');

const User = require('../models/userModel');
const catchAsync = require('../utilities/catchAsync');
const AppError = require('../utilities/appError');
const factory = require('./handlerFactory');

//  Store the file in the file system
// const multerStorage = multer.diskStorage({
//   // // location to save the uploaded images
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     // we want the file name be "user-userId-CurrenttimeStamp.jpeg
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });
// Store the photo in the memory (Ram) as a buffer
const multerStorage = multer.memoryStorage();

// Don't allow to upload anything except images
// Multer filter to test if the uploaded file is an image.And if it is so,
// then we pass true into the callback function,and if it's not we pass false into the callback  function, along with an error.
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! please upload only an image', 400), false);
  }
};

const upload = multer({
  // // location to save the uploaded images
  // dest: 'public/img/users',
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 10000000,
  },
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  // resize(width, height;)

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // console.log('processing starts ');

  const buffer = await jimp.read(req.file.buffer);
  await buffer
    .resize(500, 500) // resize
    .quality(90) // set JPEG quality
    .write(`public/img/users/${req.file.filename}`);

  // console.log('processing ends');
  next();
});

// const APIFeatures = require('../utilities/apiFeatures');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

//  Route handler (controllers)

exports.updateMe = catchAsync(async (req, res, next) => {
  // console.log('updatingssss');

  // console.log(req.file);
  // console.log(req.body);
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filter out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');

  // Delete the old photo if there was a new photo
  if (req.file) {
    filteredBody.photo = req.file.filename;
    const oldPhotoName = req.user.photo;

    // delete the older photo
    fs.unlink(`public/img/users/${oldPhotoName}`, (err) => {
      if (err) {
        return next(
          new AppError("Couldn't delete the old photo. Please try again!", 500)
        );
      }
      // console.log('Old photo is deleted.');
    });
  }

  // 2) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser },
  });
});

exports.deleteMe = catchAsync(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined. Please use /signup instead',
  });
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
// Do Not update Password with this
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
