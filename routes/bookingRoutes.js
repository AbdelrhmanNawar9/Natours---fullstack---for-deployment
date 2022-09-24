const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

// Router definition
const router = express.Router({
  mergeParams: true,
});

router.use(authController.protect);

// this route will now follow the REST principles because this one is not really gonna be about creating or getting or updating any booking. but it will be for the client to get a checkout session
router.get('/checkout-session/:tourId', bookingController.getCheckoutSession);

router
  .route('/')
  .get(bookingController.getAllBooking)
  .post(bookingController.createBooking);

router.use(authController.restrictTo('admin', 'lead-guide'));

router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);

module.exports = router;
