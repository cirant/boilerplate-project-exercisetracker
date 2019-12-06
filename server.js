const express = require('express')
const app = express()
const bodyParser = require('body-parser')
var validateDate = require("validate-date");
require('dotenv').config();

const cors = require('cors')

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: String,
  log: [{
    type: Schema.Types.ObjectId,
    ref: 'Log',
  }]
});

const logSchema = new Schema({
  description: String,
  duration: Number,
  date: Date,
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
});

const User = mongoose.model('User', userSchema);
const UserLog = mongoose.model('Log', logSchema);

app.use(cors())

app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get('/api/exercise/log', (req, res, next) => {

  const {
    userId,
    limit,
    from,
    to
  } = req.query;

  try {
    if (!userId) {
      next(new Error('userId is required'));
    } else {
      User.findById(userId)
        .select('username')
        .populate({
          path: 'log',
          match: {
            date: {
              $gte: from ? new Date(from) : new Date(0),
              $lte: to ? new Date(to) : new Date()
            }
          },
          select: 'duration -_id description date',
          options: {
            limit: limit || 0,
          },
        })
        .then(user => {
          res.status(200).json(user);
        }).catch(e => {
          console.log('error', e)
        });
    }

  } catch (error) {
    console.log('errr', error)
  }

});

app.post('/api/exercise/new-user', (req, res, next) => {
  const {
    username
  } = req.body;

  try {

    if (!username) {
      return next(new Error('username is required'))
    }

    User.findOne({
      username: username
    }).
    then(response => {
      if (response) {
        return next(new Error('username already exist!'));
      }

      const user = new User({
        username: username
      });

      user.save((err, response) => {
        if (err) {
          return next(new Error('create user error!!'));
        }

        res.status(200).json({
          username: response.username,
          _id: response._id
        });
      })


    });

  } catch (e) {
    next(e);
  }

});

app.post('/api/exercise/add', (req, res, next) => {

  const toValidate = ['userId', 'description', 'duration']

  try {

    toValidate.forEach(input => {
      if (!req.body[input]) {
        return next(new Error(`${input} is required`));
      }
    });

    const {
      userId,
      description,
      duration,
      date
    } = req.body;

    User.findById(mongoose.Types.ObjectId(userId)).
    then(user => {

      if (!user) {
        return next(new Error("user doesn's exist!"));
      }

      const reg = new RegExp(/^\D+\s\D+\s\d{2}\s\d{4}/, 'ig');

      const log = new UserLog({
        description: description,
        duration: Number(duration),
        date: new Date().setHours(0, 0, 0, 0),
        creator: user
      });

      if (date) {
        const validDate = new RegExp(/^\d{4}-\d{2}-\d{2}$/);
        if (validDate.test(date) && validateDate(date) === 'Valid Date') {
          log.date = new Date(date);
        }
      }

      log.save((err, responseLog) => {
        user.log.push(responseLog);
        user.save((err, response) => {
          res.status(200).json({
            username: user.username,
            description: log.description,
            duration: log.duration,
            _id: user._id,
            data: log.date.toString().match(reg)[0]
          });
        });
      });

    });


  } catch (e) {
    next(e);
  }

});


// Not found middleware
app.use((req, res, next) => {
  return next({
    status: 404,
    message: 'not found'
  })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});


mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  app.listen(process.env.PORT || 3000);
}).catch(err => {
  console.log('error ', err)
})