/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

// const stripe = Stripe(
//   'pk_test_51LOkQ4FyOVf3kcmi5l9Oh6mStRJuGCcBWgEtcZ9X0Z44dqe6LLdUs5k6xbDgPR95iMLUhCtVBDRsSnNG5fOqTH9S00ieyVlM8d'
// );

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // console.log({ session });
    // await stripe.redirectToCheckout({
    //   sessionId: session.data.session.id,
    // });

    window.location = session.data.session.url;

    // 2) Create checkout form + charge credit card
  } catch (err) {
    // console.log(err);
    showAlert('error', err);
  }
};
