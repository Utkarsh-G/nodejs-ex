//  OpenShift sample Node application
var express     = require('express'),
    app         = express(),
    morgan      = require('morgan'),
    bodyParser  = require('body-parser'),
    mdb         = require('moviedb')('f966801bba64717541e531a67551ed33'),
    methodOv    = require("method-override");
    var mongodb = require('mongodb');
    var ObjectId = mongodb.ObjectID;

var ipLocal = '127.0.0.1';
var portLocal = 8080;
    
Object.assign=require('object-assign');

//app.engine('html', require('ejs').renderFile);
app.set('views', './views');
app.set('view engine', 'pug');
app.use(morgan('combined'));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOv("_method"));

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || portLocal,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || ipLocal,
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
  else {console.log('mongoURL: %s', mongoURL);} 

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
                    {name: "Jumanji2", year: 2017},
                    {name: "Whiplash", year: 2014}
                    ];

function initMovies(){
  if (db)
  {
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
            res.render('index', { pageCountMessage : count, dbInfo: dbDetails, movies: null });
            
          }
          else {
            console.log("Found the movies. Sending results to index.html");
            res.render('index', { pageCountMessage : count, dbInfo: dbDetails, movies: results });
          }
        });
    });

    

  } else {
    res.render('index', { pageCountMessage : null, movies: null});
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

//RESTful Routes ... eventually
//INDEX route
app.get("/movies", function(req,res){
  movies = db.collection('movies');
  if (db)
  {
    movies.find().toArray(function(err, movArray){
      if(err)
      {
        console.log(err);
        res.render("index");
        return;
      }
      else
      {
        res.render("index", {movies : movArray});
      }
    });
  }
  else
  {
    res.render("index");
  }
});

//NEW route
app.get("/movies/new", function(req,res){
  res.render("new");
});

//CREATE route
app.post("/movies", function(req,res){
  //create movie
  movies = db.collection('movies');
  movies.insertOne(req.body.movie, function(err, newMov){
    if(err){
      console.log("Error in trying to add new movie");
      console.log(err);
      res.render("new");
    }
    else
    {
      //redirect
      res.redirect("/movies");
    }
  });
});

//SHOW route
app.get("/movies/:id", function(req,res){
  movies = db.collection('movies');
  movies.findOne({_id: ObjectId(req.params.id)}, function(err, foundMovie){ //_id:req.params.id
    if(err)
    {
      console.log("\n\nError in finding movie by id");
      console.log(err);
      res.send("Movie not found. Woopsie");
    }
    else
    {
      console.log("\n\nFound by ID");
      console.log(foundMovie);
      res.render("show",{movie: foundMovie});
    }
  });
});

// EDIT route

app.get("/movies/:id/edit", function(req, res){
  movies = db.collection('movies');

  movies.findOne({_id: ObjectId(req.params.id)}, function(err, foundMovie){ //_id:req.params.id
    if(err)
    {
      console.log("\n\nError in finding movie by id");
      console.log(err);
      res.send("Movie not found. Woopsie");
    }
    else
    {
      console.log("\n\nFound by ID");
      console.log(foundMovie);
      res.render("edit",{movie: foundMovie});
    }
  });
});

// UPDATE Route
app.put("/movies/:id", function(req,res){
  movies = db.collection('movies');

  movies.updateOne({_id: ObjectId(req.params.id)}, {$set:{
    name: req.body.movie.name,
    year: req.body.movie.year
  }}, function(err, r){

    if(err)
    {
      console.log("\n\nError in finding movie by id");
      console.log(err);
      res.send("Movie not updated. Woopsie.");
    }
    else
    {
      console.log("\n\nUpdated by ID");
      //redirect
      res.redirect("/movies/"+req.params.id);
    }

  });
});
app.get("/latest", function(req, res){
  console.log("\n\nRouting latest\n");

  mdb.movieInfo({id:348}, (err, result)=> {
    if(err)
    {
      console.log("\nERROR in retreiving latest\n");
      console.log(err);
    }
    else
    {
      console.log("\nFOUND latest\n");
      console.log(result);
      console.log("\n\nTitle:");
      console.log(result.title);
    }
  });

  res.render("index");
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
