;(function(exports) {

var { alt } = require('../alt-app')
var { GalleryClient } = require('../ServerFlickrClient')

class GalleryActions {
		constructor() {
				this.generateActions('prevPage', 'nextPage')
		}

		getPhotos(options, params) {
				console.log(options)
				for (var key in params) {
						options[key] = params[key]
				}
				console.log(options)
				if (options.page) {
						options.page = Math.ceil(options.page / 25)
				}
				GalleryClient.requestPhotos(options)
				.then((data) => {
						data = data.photos
						var obj = { params, data }
						this.dispatch(obj)
				})
		}

		vote(photoId, user) {
				GalleryClient.vote(photoId, user)
				.then((resp) => this.dispatch(resp))
		}

		changePage(newPage, needRequest) {
				if (needRequest === 'request') {
						this.getPhotos({}, {page: newPage})
						return
				}
				this.dispatch(newPage)
		}
}


exports.GalleryActions = GalleryActions
exports.galleryActions = alt.createActions(GalleryActions)

})(typeof module === 'object' ? module.exports : window)