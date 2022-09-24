const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be above 1.0, got {VALUE}'],
      max: [5, 'Rating must be below 5.0, got {VALUE}'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  //   Make virtual properties shows whenever there is an output
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    validateBeforeSave: true,
  }
);

// Compound index of user and tour so that the
// so that the this compination is unique
reviewSchema.index({ user: 1, tour: 1 }, { unique: true });

// Query middleware tp populate user and tour for the review
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'tour',
    select: 'name imageCover',
  }).populate({
    path: 'user',
    select: 'name photo',
  });

  // this.populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  next();
});

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // This Keyword in a static method like calcAverageRatings points to the current model
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRatings: { $sum: 1 },
        aveRating: { $avg: '$rating' },
      },
    },
  ]);
  // console.log({ stats });

  // Saving the RatingsAverage to the tour in DB only if there is a Review in for this tour (stats has an element)
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: stats[0].aveRating,
      ratingsQuantity: stats[0].nRatings,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: 4.5,
      ratingsQuantity: 0,
    });
  }
};

// We use post not pre  to make sue the last review is included in the DB
reviewSchema.post('save', function () {
  // This points to current review
  // this.constructor points to the Model which created the document instance which is in this case Review
  this.constructor.calcAverageRatings(this.tour);
});

// Updating or deleting a review
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // This points to the Query
  this.review = await this.findOne();
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await findOne() won't work here; the query has already executed
  await this.review.constructor.calcAverageRatings(this.review.tour);
});

// Create the Review Model out of the reviewSchema
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
