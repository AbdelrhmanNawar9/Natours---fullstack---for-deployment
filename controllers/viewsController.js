const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const AppError = require('../utilities/appError');
const catchAsync = require('../utilities/catchAsync');

exports.getOverview = catchAsync(async (req, res) => {
  // 1) Get tour data from Tour collection in DB
  const tours = await Tour.find();
  // console.log(tours);

  // 2) Build template
  // 3) Render that template using tour data from 1)
  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the date, for the requested tour (including reviews and guides)
  const { tourName } = req.params;
  // console.log({ tourName });
  const tour = await Tour.findOne({ slug: tourName }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    const error = new AppError('There is no tour with that name.', 404);
    return next(error);
  }

  // 2) Build template
  // 3) Render that template using tour data from 1)
  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour: tour,
  });
});

exports.getLoginForm = catchAsync(async (req, res, next) => {
  res.status(200).render('login', {
    title: 'Log in ',
  });
});

exports.getAccount = catchAsync(async (req, res, next) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
});

exports.getMyTours = catchAsync(async (req, res, next) => {
  // we could have also used virtual population for this part
  // 1) Find all bookings for the current user
  const bookings = await Booking.find({
    user: req.user.id,
  });

  // console.log({ bookings });

  // 2) Find tours with the returned IDs
  const tourIDs = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});
