import React from 'react'
import _ from 'lodash'

import AutobindComponent from './AutobindComponent'

export default function injectGalleryStore(Component) {

	class GalleryStoreContainer extends AutobindComponent {
		constructor(props, context) {
			super()

			this._store = context.alt.getStore('gallery')
			this._actions = context.alt.getActions('gallery')

			this.state = this._store.getState()

			this._bind('_onStoreChange', '_shouldStoreFetch')
		}

		componentWillMount() {
			this._shouldStoreFetch()
		}

		componentDidMount() {
			this._store.listen(this._onStoreChange)
		}

		componentWillUnmount() {
			this._store.unlisten(this._onStoreChange)
		}

		render() {
			return <Component storeData={this.state} actions={this._actions} {...this.props} />
		}

		_onStoreChange() {
			this.setState(this._store.getState())
		}

		_shouldStoreFetch() {
				var params = this.context.router.getCurrentParams()
			console.log(params)
			var prevParams = this.state.requestParams
			console.log(prevParams)

			// check if exact request has happened
			var prevParamsMatch = prevParams.filter(function(val) {
				return _.isEqual(val, params)
			})

			// cached load
			if (prevParamsMatch.length) {
				console.log('prevParams match')
				this._actions.cachedLoad(params)
			}

			// page change?
			else if (params.tags !== undefined && prevParams[0] && params.tags === prevParams[0].tags) {
				console.log('page change')
				this._actions.changePage(params)
			}

			// request -- new set of tags
			else {
				console.log('gimme new data')
				this._actions.getPhotos(params)
			}
		}
	}

	GalleryStoreContainer.contextTypes = {
		alt: React.PropTypes.object.isRequired,
		router: React.PropTypes.func.isRequired
	}

	return GalleryStoreContainer
}