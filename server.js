const mongoose = require('mongoose');

const dotenv = require('dotenv');

// Handle unhandled uncaught exception
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION ! 💀 SHUTTING DOWN...');
  console.log(err);
  console.log(err.name, err.message);

  // 1 stands for uncaught exception usually used here
  // crashing the app is necessary here
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

// CONNECT TO THE DB
// connect method return a promise
mongoose
  .connect(DB, {
    // these are just options to deal with some deprecation warnings.
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    autoIndex: true, //this is the code I added that solved it all
  })
  .then(() => {
    console.log('DB connection successfully!');
  });

// 4) Start the server
const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

// Handle unhandled rejected promises (like connecting to the database )
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💀 SHUTTING DOWN...');
  console.log(err);

  // close the server safely after finishing the current requests
  server.close(() => {
    // 1 stands for uncaught exception usually used here
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('🌚 SIGTERM RECIEVED. Shutting down gracefully');
  server.close(() => {
    console.log('🌙 Process terminated!');
  });
});
