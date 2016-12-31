var DEBUG = true;
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var mime = require('mime');
var cache = {};
var crypto = require('crypto');
var base64url = require('base64url');
var querystring = require('querystring');
var express = require('express');    //Express Web Server
var app = express();
var fileSize = 15;
var mongoose = require('mongoose')
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var passport = require("passport");
var LocalStrategy = require('passport-local').Strategy;

var express = require('express');    //Express Web Server
var app = express();
var flash = require('connect-flash');
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var configDB = require('./config/database.js');

mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport);

app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser()); // get information from html forms


// required for passport
app.use(session({ secret: 'livewriting' })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

//var absolutePath = "/home/snaglee/livewriting_server"
// this is for local running
//var absolutePath = "/home/snaglee/op_livewriting"
// this is for local running
var absolutePath = "/Users/sangwonlee/Box Sync/Workspace/gitub_workspace/livewriting_server"
/** Sync */
function randomStringAsBase64Url(size) {
    return base64url(crypto.randomBytes(size));
}

CommonManager = {
    getPostData: function (req, res, callback) {
        // Check if this is a form post or a stream post via REST client.
        if (req.readable) {
            // REST post.
            var content = '';
            req.on('data', function (data) {
                if (content.length > 1e16) {
                    // Flood attack or faulty client, nuke request.
                    res.json({ error: 'Request entity too large.' }, 413);
                }
                // Append data.
                content += data;
            });
            req.on('end', function () {
                // Return the posted data.
                callback(content);
            });
        }
        else {
            // Form post.
            callback(req.body);
        }
    }
}

var insertDocument = function(db, data, callback) {
  data.servertime = (new Date()).getTime();
  db.collection('Articles').insertOne( data, function(err, result) {
    if(DEBUG)console.log("inserting: " + data.aid);
    assert.equal(err, null);
    if(DEBUG)console.log("Inserted a document into the Articles collection. : " + data._id);
    if (callback)callback();
  });
};

var retreiveArticle = function(db, aid){
  var promise;
  try {
    if(aid.length<=20){		    promise = db.collection('Articles').findOne({$or:[ {'_id':mongoose.Types.ObjectId(aid)}, {'aid' : aid} ]});
        promise = db.collection('Articles').findOne( {'aid' : aid} );
    }else{
         promise = db.collection('Articles').findOne({'_id':mongoose.Types.ObjectId(aid)});
    }
  } catch (err) {
    console.log(err);
  }
  return promise;
};

var updateArticle = function(db, id, email){
  var result;
  try {
    result = db.collection('Articles').update({'_id':mongoose.Types.ObjectId(id)}, {$set: {"useroptions.email":email}});
  } catch (err) {
    console.log(err);
  }
  return result;
};

var retreiveDocsList = function(db, offset, num, email){
  var cursor;
  var options = {
    "limit": num,
    "skip": offset,
    "sort":  [['servertime','desc'],['useroptions.servertime','desc']]
  };
  var query = {};
  if(email){
    query = {'useroptions.email':email};
  }

  try {
    cursor = db.collection('Articles')
    .find(query
          ,{useroptions:true,_id:true, localEndtime:true, servertime:true}
          ,options);
  } catch (err) {
    console.log(err);
  }
  return cursor;
};

console.log(configDB.url);
MongoClient.connect(configDB.url, function(err, db) {
  app.locals.db = db;
  var server = app.listen(2401, function() {
      console.log('Listening on port %d', server.address().port);
  });

});


app.use(express.static( absolutePath +'/public_html/'));

app.get('/', function(req, res) {
    res.sendFile(path.join(absolutePath + '/public_html/index.html'));
});

app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/profile', // redirect to the secure profile section
    failureRedirect : '/error-signup', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
}));

app.post('/login', passport.authenticate('local-login', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/error-login', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
  }));

app.post('/admin-login', passport.authenticate('local-login', {
    successRedirect : '/admin-check', // redirect to the secure profile section
    failureRedirect : '/error-login', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
}));

app.get('/profile', isLoggedIn, function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(req.user.local.email);
});

app.get('/admin-check', isAdminLoggedin, function(req,res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('admin-login-successful');
})

app.post('/get-admin-articles', isAdminLoggedin, function(req, res){
  CommonManager.getPostData(req, res, function (data) {
    console.log("get-admin-articles",data);
    var list = retreiveDocsList(app.locals.db, data.offset, data.num);
    list.toArray(function(err, docs){
      if(err){
        res.writeHead(200, {'Content-type': 'application/json'});
        res.end(err);
      }
      else{
        res.writeHead(200, {'Content-type': 'application/json'});
        res.end(JSON.stringify(docs));
      }
    });

  });
});

app.get('/error-not-admin-login', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  try{
      console.log(req.user.local.email , " tried to access backoffice.");
  }
  catch(err){
    console.log(err);
  }
  res.end("admin-login-failed");
});

app.get('/error-login', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("login-failed");
});

app.get('/error-signup', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("signup-failed");
});

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end("logout");
    });

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/error-login');
}

function isAdminLoggedin(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated()){
      var promise = app.locals.db.collection('users').findOne({"local.email":req.user.local.email});
      promise.then(function(data){
        if(data.local.role===0){
          next();
        }
        else{
          res.redirect('/error-not-admin-login');
        }
      });
    }
    // if they aren't redirect them to the home page

}

app.get('/whattime', function (req, res) {
    var now = new Date().getTime();
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(now.toString());
});

// accept POST request at /play
app.post('/play', function (req, res) {

    if(DEBUG)console.log('do you want to play?');
    CommonManager.getPostData(req, res, function (data) {

        if(DEBUG)console.log('aid recieved:' + data['aid']);

        retreiveArticle(app.locals.db, data['aid'])
        .then(function(article){
          console.log("retreiveArticle:",article);
          if(article == null){
            if(DEBUG)console.log("file does not exist:"+data['aid']);
            res.writeHead(404, {'Content-type': 'application/json'});
            res.end('{"state" : "file does not exists", "status" : 404}')
          }
          else{
            console.log("Data Transferred1");
            res.writeHead(200, {'Content-type': 'application/json'});
            res.write(JSON.stringify(article));
            res.end();
            console.log("Data Transferred2");
          }
        });
    });
});

app.get('/', function(req,res){

});

// accept PUT request at /post
app.post('/post', function (req, res) {
  if(DEBUG)console.log('do you want to post?', req.body);
  var strChunk = "";
  CommonManager.getPostData(req, res, function (data) {
    data = JSON.parse(data);
    insertDocument(app.locals.db, data, function(){
      console.log("inserted", data._id);
      res.writeHead(200, {'Content-type': 'application/json'});
      res.end('{"success" : "Updated Successfully", "status" : 200, "aid": "'+data._id+'"}'  );
    });
  });
});

app.post("/updateemail", isLoggedIn, function(req,res){
  CommonManager.getPostData(req, res, function (data) {
    var _id = data.id;
    var email = data.email;
    if (req.user.local.email !=email){
      res.writeHead(404, {'Content-type': 'application/json'});
      res.end({state:"failed"});
      return;
    }
    var promise = updateArticle(app.locals.db, _id, email);
    console.log("updateemail data", data);
    promise.then(function(data){
      console.log("updateemail result", data);
      res.writeHead(200, {'Content-type': 'application/json'});
      res.end(JSON.stringify(data));
    });

  });
});

app.post("/getlist", isLoggedIn, function(req,res){
  CommonManager.getPostData(req, res, function (data) {
    var list = retreiveDocsList(app.locals.db, data.offset, data.num,req.user.local.email);
    list.toArray(function(err, docs){
      if(err){
        res.writeHead(200, {'Content-type': 'application/json'});
        res.end(err);
      }
      else{
        res.writeHead(200, {'Content-type': 'application/json'});
        res.end(JSON.stringify(docs));
      }
    });

  });
});
