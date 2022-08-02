/* eslint-disable no-unused-vars */
const multer = require('multer');
const jimp = require('jimp');

const Tour = require('../models/tourModel');
const catchAsync = require('../utilities/catchAsync');
const AppError = require('../utilities/appError');
const factory = require('./handlerFactory');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingAverage,summary,difficulty ';
  next();
};

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
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

exports.resizeTourimages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  const coverBuffer = await jimp.read(req.files.imageCover[0].buffer);
  await coverBuffer
    // 3/2 ratio
    .resize(2000, 1333) // resize
    .quality(90) // set JPEG quality
    .write(`public/img/tours/${req.body.imageCover}`);

  // Images
  req.body.images = [];

  // If we didn't use Promise.all the code will not stop(await) in this part even if there is await inside the map function (async await will not stop the code here as it is inside a callback)
  // - we used map method instead of foreach, because map return an array we can pass to Promise.all
  await Promise.all(
    req.files.images.map(async (image, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      const imageBuffer = await jimp.read(image.buffer);
      await imageBuffer
        // 3/2 ratio
        .resize(2000, 1333, jimp.RESIZE_NEAREST_NEIGHBOR) // resize
        .quality(90) // set JPEG quality
        .write(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  //ass array of stages
  const stats = await Tour.aggregate([
    // {
    //   $match: { ratingsAverage: { $gte: 4.5 } },
    // },
    {
      // to group results for different fields change the _id: '$<fieldName>
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        //  numTours:{ $count:{}},
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: {
        // 1 for ascending
        avgPrice: 1,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    { $unwind: '$startDates' },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStart: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    { $project: { _id: 0 } },
    { $sort: { numTourStart: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: plan,
  });
});

// '/tours-within/:distance/center/:latlng/unit/:unit',
// /tours-within/223/center/34.111745,-118.118.113491/unit/mi
// another way
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // radius in radian (by converting the distance/ Radius of the earth)
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6387.1;
  if (!lat || !lng) {
    next(
      new AppError(
        'Pleaser provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius],
      },
    },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const multiplier = unit === 'ml' ? 0.000621371192 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Pleaser provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  //  The following geospatial aggregation will make a field called distance and the calculation will be in it for every tour
  const distances = await Tour.aggregate([
    {
      // geoNear operator must be the first stage in the aggregate pipeline
      $geoNear: {
        // define the center point form which the distances is calculated
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        // distance must be in meter
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    { $project: { name: 1, distance: 1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
