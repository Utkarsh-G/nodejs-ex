//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    morgan  = require('morgan');

var isLocal = false;

var ipDefault = '0.0.0.0';

if (isLocal)
{
  ipDefault = '127.0.0.1';
}
    
Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || ipDefault,
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();
console.log("Trying to init DB");
mongoURL = mongoURL || "mongodb://localhost/movies";
var initDb = function(callback) {
  if (mongoURL == null) {console.log("mongoURL is null"); return;} 

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      console.log("error connecting to mongodb")
      console.log(err);
      callback(err);
      return;
    }

    

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);

    if (db) {
      initMovies();
    }

  });
};

var sampleMovies = [{name: "Bladerunner", year: 2017},
                    {name: "Jumanji 2", year: 2017},
                    {name: "Whiplash", year: 2014}
                    ];

function initMovies(){
  // if (!db) {
  //   initDb(function(err){
  //     console.log("Connection to DB successful!");
  //   });
  // }
  if (db)
  {
    //var movie = db.collection('movies');
    db.collection('movies').insertOne({name: "El laberinto del fauno", year: 2006}, function(err, r){
      if(err)
      {
        console.log("Failed to insert token movie");
        console.log(err);
      }
      else
      {
        console.log("Successfully inserted token movie");
        db.collection('movies').drop(function(err, delOK){
          if (err)
          {
            console.log("Failed to delete movies");
            console.log(err);
          }
          else {
            console.log("Prev data deleted successfully. Creating new movie data.");
            db.collection('movies').insertMany(sampleMovies, function (err, res){
              if (err)
              {
                console.log("Failed to insert movies");
                console.log(err);
              }
              else {
                console.log("New Movie DB ready to go.");          
              }
            });
          }
      
        });
      }

    });
    
  }
  else 
  {
    console.log("no definition for db :(")
  }
  
}

//initMovies();

app.get('/', function (req, res) {
  console.log("Routing GET");
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      if (err) {
        console.log('Error running count. Message:\n'+err);
      }
      var movie = db.collection('movies');

        movie.find({year: 2017}).toArray(function(err, results){
          if(err)
          {
            console.log("failed to find 2017 movies");
            res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails, movieInfo: null });
          }
          else {
            console.log("Found the movies. Sending results to index.html");
            res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails, movieInfo: results });
          }
        });
    });

    

  } else {
    res.render('index.html', { pageCountMessage : null, movieInfo: null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  if (err)
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
