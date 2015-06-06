import _ from 'lodash'
import React from 'react'
import { Link } from 'react-router'

import AutobindComponent from './AutobindComponent'
import Photo from './Photo'

export default class GalleryView extends AutobindComponent {

	constructor(props, context) {
		super()

		this._bind('_search', '_removeTag')
	}

	render() {
		var tags = this._tagsMarkup()
		if (this.props.storeData.isLoading) return this._loadingMarkup()
		var photos = this._currentPhotosMarkup()
		var galleryRoute = this.props.storeData.isSearch ? 'gallerysearch' : 'gallerynosearch'

		return (
			<main className="gallery">
				<form onSubmit={this._search}>
					<input type="search" ref="search" />
				</form>
				{tags}
				<div className="photos">
					{photos}
				</div>
				<div className="pages">
					{this.props.storeData.paginate.prevPageExists
						? <Link to={galleryRoute} params={this.props.storeData.paginate.prevPageParams}><h6 className="prev">Prev</h6></Link>
						: <h6></h6>}

					<h6 className="current">{this.props.storeData.paginate.currentPage}</h6>

					{this.props.storeData.paginate.nextPageExists
						? <Link to={galleryRoute} params={this.props.storeData.paginate.nextPageParams}><h6 className="next">Next</h6></Link>
						: <h6></h6>}
				</div>
			</main>
		)
	}

	_search(e) {
		e.preventDefault()
		var newTags = React.findDOMNode(this.refs.search).value.split(' ')
		if (newTags.length) {
			React.findDOMNode(this.refs.search).value = ''
			newTags = this._sortTags(this.props.storeData.tags.concat(newTags))
			this.context.router.transitionTo('gallerysearch', {tags: newTags, page: 1})
		}
	}

	_removeTag(e) {
		var tag = e.target.parentNode.id.slice(3)
		var tags = this.props.storeData.tags
		tags.splice(tags.indexOf(tag), 1)
		tags = this._sortTags(tags)

		if (tags.length) {
			this.context.router.transitionTo('gallerysearch', {tags: tags, page: 1})
		}
		else {
			this.context.router.transitionTo('gallerynosearch', {page: 1})
		}
	}

	_sortTags(tags) {
		return tags.sort()
	}

	_currentPhotosMarkup() {
		var currentPhotos = this.props.storeData.paginate.currentPhotos.map((photo) => {
			return <Photo tags={this.props.storeData.tags} photo={photo} user={this.props.user} key={photo.photo_id} actions={this.props.actions} />
		})
		if (!currentPhotos.length && !this.props.storeData.isLoading) return <h2>No results</h2>
		return currentPhotos
	}

	_tagsMarkup() {
		var tags
		this.props.storeData.isSearch
			? tags =
				<div className="tags">
					{this.props.storeData.tags.map((tag) => {
						var id = `tag${tag}`
						return (
							<span className="tag" key={tag} id={id}>
								<span>{tag}</span>
								<span className="x" onClick={this._removeTag}>x</span>
							</span>
						)
					})}
				</div>
			: null

		return tags
	}

	_loadingMarkup() {
		var tags = this._tagsMarkup()
		return (
			<main className="gallery loading">
				<form onSubmit={this._search}>
					<input type="search" ref="search" />
				</form>
				{tags}
				<h2>Loading<span>.</span><span>.</span><span>.</span></h2>
			</main>
		)
	}
}


GalleryView.contextTypes = {
	router: React.PropTypes.func.isRequired
}
