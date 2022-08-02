const mongoose = require('mongoose');
const validator = require('validator');

const slugify = require('slugify');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxLength: [
        40,
        'A tour name must have characters less than or equal 40 character',
      ],
      minLength: [
        8,
        'A tour name must have characters more than or equal 8 character',
      ],
      validate: {
        validator: (val) => validator.isAlpha(val, ['en-US'], { ignore: ' ' }),
        message: 'Tour name must only contain characters',
      },
    },
    slug: {
      type: String,
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tout must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: `'{VALUE}' is not supported, Difficulty is either: easy, medium, difficult`,
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0, got {VALUE}'],
      max: [5, 'Rating must be below 5.0, got {VALUE}'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this refers to the current document only on new document creation not updating
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price ',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: { type: Boolean, default: false },
    startLocation: {
      // definition of a GeoJSON document in mongoDB
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      // (longitude (vertical position) , latitude (horizontal position))
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
  },
  {
    toJSON: { virtuals: true }, // So `res.json()` and other `JSON.stringify()` functions include virtuals
    toObject: { virtuals: true }, // So `console.log()` and other functions that use `toObject()` include virtuals
    validateBeforeSave: true,
  }
);

// Indexes;
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function () {
  // we didn't use arrow function ,as it don't own its this keyword
  // this will point to the current document
  return this.duration / 7;
});

// Virtual Populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// MIDDLEWARES
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// this is a middleware to exclude any secret tour
// tourSchema.pre('find', function (next) {
//  to catch all events that starts with find we use regex
tourSchema.pre(/^find/, function (next) {
  // this is gonna point to the currently processed query
  // console.log(this);
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();

  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangeAt',
  });
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   // this is gonna point to the query result [docs]
//   console.log(`Query took ${Date.now() - this.start} milliseconds`);

//   next();
// });

// aggregation Middleware
// tourSchema.pre('aggregate', function (next) {
//   // this point to the current aggregation object
//   // console.log(this.pipeline());

//   // this.pipeline is the stages array
//   // adding a match stage to the begin of the stages array (in any aggregate method )  to only pass the document that has field secretTour: not equal to true
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   console.log(this.pipeline());
//   next();
// });

// creating a model Tour (this will create a db with the project name and a collection with Tours automatically )
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
