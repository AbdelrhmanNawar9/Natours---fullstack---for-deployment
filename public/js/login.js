/*eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  // axios triggers an error whenever there is an error
  // error handling in the client side
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      // redirect to homePage
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
    }

    // console.log({ res });
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

// // 1- Get data from the form
// const data = {
//   email: document.getElementById('email').value,
//   password: document.getElementById('password').value,
// };

//   // Send the login request to the API usibg pure JS
//   const URL = `/api/v1/users/login`;
//   const otherParams = {
//     headers: { 'content-type': 'application/json; charset=UTF-8' },
//     body: JSON.stringify(data),
//     method: 'POST',
//   };

//   fetch(URL, otherParams)
//     .then(function (response) {
//       console.log({ response });
//       return response.json();
//     })
//     .then(function (res) {
//       console.log({ responseData: res.data });
//       window.location = '/account';
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// });
// }

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });
    if (res.data.status === 'success') {
      // console.log('sssss', window.location.pathname);
      if (window.location.pathname === '/me') {
        return location.assign('./login');
      }
      // reload from server not from browser cash (we want a fresh page coming from the server)
      location.reload(true);
    }
  } catch (err) {
    // console.log({ err: err.response });
    showAlert('error', 'Error logging out! Try again.');
  }
};
