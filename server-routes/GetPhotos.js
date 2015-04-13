var request = require('request')
var Promise = require('bluebird')
var Parse = require('parse').Parse

var weightVotes = require('./utils/weightVotes')
var ParseClass = require('./utils/ParseClass')
var trimPhoto = require('./utils/trimPhoto')
var flickrRequestUrl = require('./utils/flickrRequestUrl')


module.exports = photos


// handle request
function photos(req, res) {

	var url = flickrRequestUrl(req.query, req.route)

	request.get(url, function(err, resp, body) {

		if (err != null) {
			res.send(err)
			console.log(err)
			return
		}

		var flickrResponse = trimFlickrResponse(body, req.query)

		getDbMatches(flickrResponse, req)
			.then(mergeDbData)
			.then(getDbVoted)
			.then(mergeVotes)
			.then(calcWeightedVotes)
			.then(sortPhotos)
			.then(truncatePhotos)
			.then(function(data) {
				res.send({photos: data.aggregate.photos})
				return data
			})
			.then(savePhotos)
			.catch(handleError)
	})
}


// get photos from Flickr
function trimFlickrResponse(data, reqQuery) {

	var photos
	var photo_ids = []
	data = JSON.parse(data)

	data.photos.tags = reqQuery.tags.slice(2)

	// get ids of fetched photos and trim photo info for Parse
	for (var i = 0, arr = data.photos.photo, imax = arr.length; i < imax; i++) {
		arr[i] = trimPhoto(arr[i])
		photo_ids.push(arr[i].photo_id)
	}

	return {photos: data.photos, photo_ids: photo_ids}

}



// query for photos from db that match photos from flickr request
function getDbMatches(flickrResponse, req) {

	var query = new Parse.Query('Photo')

	query.containedIn('photo_id', flickrResponse.photo_ids)
			 .select('photo_id', 'tag_votes', 'user_votes', 'total_votes')
			 .limit(500)

	var promise = new Promise(function(resolve, reject) {
		query.find({
			success: function(result) {
				resolve({parseDb: result, aggregate: flickrResponse, req: req})
			},
			error: function(err) {
				reject(err)
			}
		})
	})

	return promise
}



// merge db response with flickr response
function mergeDbData(data) {

	var aggregateData = data.aggregate.photos
	var parseDb = data.parseDb
	var reqQuery = data.req.query

	var savePhotos = []
	var parseIds = getParseIds(parseDb)

	// photos for saving to db -- initialize votes info for photos not in db
	for (var i = 0, arr = aggregateData.photo, imax = arr.length, counter = 0; i < imax; i++) {
		var parseMatchIndex = parseIds.indexOf(arr[i].photo_id)
		var copy = {}

		if (parseMatchIndex === -1) {
			arr[i].user_votes = []
			arr[i].total_votes = 0
			arr[i].tag_votes = {}

			for (var key in arr[i]) {
				if (arr[i].hasOwnProperty(key)) {
					copy[key] = arr[i][key]
				}
			}
			savePhotos.push(copy)
		}

		// update db entry with flickr data, add db entry to aggregate array
		else {
			for (var key in arr[i]) {
				parseDb[parseMatchIndex].set(key, arr[i][key])
			}

			arr[i] = parseDb[parseMatchIndex].toJSON()
			savePhotos.push(parseDb[parseMatchIndex])
		}
	}

	delete data.parseDb
	data.savePhotos = savePhotos

	return data
}



function getParseIds(parseDb) {

	var ids = []

	for (var i = 0, arr = parseDb, imax = arr.length; i < imax; i++) {
		ids.push(arr[i].attributes.photo_id)
	}

	return ids
}


function getDbVoted(data) {

	var thirtyDaysAgo = Math.round((new Date() - (1000 * 60 * 60 * 24 * 30)) / 1000)

	var aggregateData = data.aggregate.photos
	var	photoIds = data.aggregate.photo_ids
	var reqQuery = data.req.query

	// new query for Parse -- get rankings that fit flickr request query
	var queryVotes = new Parse.Query('Photo')

	if (aggregateData.tags.length) queryVotes.containsAll('tags', aggregateData.tags)
	queryVotes.notContainedIn('photo_ids', photoIds)
		      .greaterThan('total_votes', 0)
		      .greaterThan('date_uploaded', thirtyDaysAgo)
		      .descending('total_votes')
		      .addAscending('date_uploaded')
		      .limit(500)

	var promise = new Promise(function(resolve, reject) {
		queryVotes.find({
			success: function(result) {
				data.votes = result
				resolve(data)
			},
			error: function(err) {
				reject(err)
			}
		})
	})

	return promise
}


function mergeVotes(data) {

	if (data.votes.length) {
		for (var i = 0, arr = data.votes, imax = arr.length; i < imax; i++) {
			arr[i] = arr[i].attributes
		}

		Array.prototype.push.apply(data.aggregate.photos.photo, data.votes)
	}

	delete data.votes
	return data
}



function calcWeightedVotes(data) {

	var aggregateData = data.aggregate.photos

	for (var i = 0, arr = aggregateData.photo, imax = arr.length; i < imax; i++) {
		arr[i].weighted_votes = weightVotes(arr[i], aggregateData.tags)
	}

	return data
}



function sortPhotos(data) {

	var aggregateData = data.aggregate.photos

	aggregateData.photo.sort(function(a, b) {
		if (a.weighted_votes > b.weighted_votes) return -1
		if (b.weighted_votes > a.weighted_votes) return 1
		if (a.total_votes > b.total_votes) return -1
		if (b.total_votes > a.total_votes) return 1
		if (a.dateupload > b.dateupload) return -1
		if (b.dateupload > a.dateupload) return 1
		return 0
	})

	return data
}



function truncatePhotos(data) {
	data.aggregate.photos.photo = data.aggregate.photos.photo.slice(0, 500)
	return data
}



function savePhotos(data) {

	var savePhotos = data.savePhotos

	Parse.Object.saveAll(savePhotos, {
		error: handleError
	})
}


// 				// save photos after response -- lots of processing time
// 				for (var i = 0, arr = newPhotos, imax = arr.length; i < imax; i++) {
// 					arr[i] = new ParseClass.Photo(arr[i])
// 				}

// 				Parse.Object.saveAll(newPhotos, {
// 					error: function(err) {
// 						console.log(err)
// 					}
// 				})

// 				Parse.Object.saveAll(savePhotos, {
// 					error: function(err) {
// 						console.log(err)
// 					}
// 				})
// 			},
// 		error: function(err) {
// 			console.log('sending, error getting votes')
// 			console.log(err)
// 			res.send(data)

// 			// save photos after response -- lots of processing time
// 			for (var i = 0, arr = savePhotos, imax = arr.length; i < imax; i++) {
// 				arr[i] = new ParseClass.Photo(arr[i])
// 			}
// 			Parse.Object.saveAll(newPhotos, {
// 				error: function(err) {
// 						console.log(err)
// 				}
// 			})

// 			Parse.Object.saveAll(savePhotos, {
// 				error: function(err) {
// 					console.log(err)
// 				}
// 			})
// 		}
// 	})
// }


// dev -- handle errors
function handleError(err) {
	console.log(err)
}