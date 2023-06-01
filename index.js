const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: false}))

let mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI)
let ObjectId = mongoose.Schema.ObjectId

//prepare for depreciation
mongoose.set('strictQuery', false)

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

let logSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: Date,
  dateString: String
}, {_id: false})

let userSchema = new mongoose.Schema({
  username: String,
  count: Number,
  log: [logSchema]
})
let User = mongoose.model('User', userSchema);

app.post('/api/users', function(req, res) {
  let newUser = new User({
    username: req.body.username,
    count: 0,
    log: []
  })
  
  newUser.save(function(err, newuser) {
    if (err) return console.error(err)
    
    res.json({
      username: req.body.username,
      _id: newuser._id
    })
  })
})

app.post('/api/users/:_id/exercises',
        (req, res) => {
          User.findById({_id: req.params._id}, (err, user) => {
            if(err) return console.error(err)

            let date = new Date()
            if(req.body.date){
              date = new Date(req.body.date)
            }
            let dateString = date.toDateString()
            
            user.log.push({description: req.body.description, duration: parseInt(req.body.duration), date: date, dateString: dateString})
            user.count += 1

            user.save((err, savedUser) => {
              if(err) return console.error(err)

              res.json({
                username: savedUser.username,
                _id: savedUser._id,
                description: req.body.description,
                duration: parseInt(req.body.duration),
                date: dateString
              })
            })
          })
        })

app.get('/api/users', 
        (req, res) => {
          User.find({}).select({username: 1, _id: 1}).exec((err, users) => {
            if(err) return console.error(err)
            res.send(users)
          })
        })


app.get('/api/users/:_id/logs', 
        (req, res) => {

          let to = new Date(req.query.to)
          let from = new Date(req.query.from)
          let limit = parseInt(req.query.limit)

          if(!req.query.limit){
            limit = 2,147,483,646
          }
          if(!req.query.from){
            from = new Date(0)
          }
          if(!req.query.to){
            to = new Date()
          }

          User.aggregate([
            {
              $match: {_id: mongoose.Types.ObjectId(req.params._id)}
            },
            {
              $project: {
                username: 1,
                count: 1,
                _id: 1,
                log: {
                  $map:{
                    input: { $slice: [
                      {
                        $filter: {
                          input: '$log',
                          cond: {
                            $and: [
                              {$gte: ["$$log.date", from]},
                              {$lte: ["$$log.date", to]}
                            ]
                          },
                          as: 'log'
                        }                      
                      }, limit
                    ] },
                    as: 'filteredLog',
                    in: {
                      "description": "$$filteredLog.description",
                      "duration": "$$filteredLog.duration",
                      "date": "$$filteredLog.dateString"
                    }
                  }
                }
              }
            }
          ]).exec((err, user) => {
            if(err) console.error(err)

            res.json(user[0])
          })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
