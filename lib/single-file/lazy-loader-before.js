/*
 * Copyright 2018 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 * 
 * This file is part of SingleFile.
 *
 *   SingleFile is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SingleFile is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with SingleFile.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global window, screen, dispatchEvent, Element, UIEvent */

(() => {

	window._singleFile_getBoundingClientRect = Element.prototype.getBoundingClientRect;
	Element.prototype.getBoundingClientRect = function () {
		const boundingRect = window._singleFile_getBoundingClientRect.call(this);
		const top = (boundingRect.top > 0 && boundingRect.top < screen.height) ? boundingRect.top : screen.height / 2;
		const left = (boundingRect.left > 0 && boundingRect.left < screen.width) ? boundingRect.left : screen.width / 2;
		const bottom = top + boundingRect.height;
		const right = left + boundingRect.width;
		return { x: boundingRect.x, y: boundingRect.y, top, bottom, left, right, width: boundingRect.width, height: boundingRect.height };
	};
	dispatchEvent(new UIEvent("scroll"));

})();