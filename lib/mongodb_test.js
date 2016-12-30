var DEBUG = true;
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var mongoose = require('mongoose')
var fs = require( 'fs' );
var path = require( 'path' );
var process = require( "process" );
//var absolutePath = "/home/snaglee/livewriting_server"
// this is for local running
//var absolutePath = "/home/snaglee/op_livewriting"
// this is for local running
var absolutePath = "/Users/sangwonlee/Box Sync/Workspace/gitub_workspace/livewriting_server"

var articleSchema = new mongoose.Schema({
	aid : String,
	version: Number,
	playback: Number,
	editor_type: String,
	initialtext: String,
	localEndTime: Number,
	localStartTime: Number,
	finaltext: String,
	useroptions: mongoose.Schema.Types.Mixed,
	action:[mongoose.Schema.Types.Mixed],
	updated: { type: Date, default: Date.now }
});

var Article = mongoose.model('Articles', articleSchema);

var dataPath = absolutePath + "/lib/data/"
var url = 'mongodb://localhost:27017/livewriting';

var insertDocument = function(db, data, callback) {
		data._id = mongoose.Types.ObjectId(aid);
   	db.collection('Articles').insertOne( data, function(err, result) {
		console.log("inserting: " + data.aid);
    assert.equal(err, null);
    console.log("Inserted a document into the Articles collection. : " + data.aid);
    if (callback)callback();
  });
};

MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server.");
	fs.readdir( dataPath, function( err, files ) {
        if( err ) {
            console.error( "Could not list the directory.", err );
            process.exit( 1 );
        }

        files.forEach( function( file, index ) {
                // Make one pass and make the file complete
          var dataFilePath = path.join( dataPath, file );
					fs.exists(dataFilePath, function(exists){
						if(! exists )
						{
							if(DEBUG)console.log("file does not exist:"+dataFilePath);
						}
						else{
							if(DEBUG)console.log("file exists:"+dataFilePath);
							fs.readFile(dataFilePath, function (err, data) {
								data = JSON.parse(data);
								data.aid = file;
								insertDocument(db,data);
							});
						}
					});
					setTimeout(function(){
						db.close();
					},5000);
			});
	} );
});
