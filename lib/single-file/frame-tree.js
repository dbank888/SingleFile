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

/* global window, top, document, addEventListener, docHelper, timeout, MessageChannel */

this.frameTree = this.frameTree || (() => {

	const MESSAGE_PREFIX = "__frameTree__::";
	const FRAMES_CSS_SELECTOR = "iframe, frame, object[type=\"text/html\"][data]";
	const INIT_REQUEST_MESSAGE = "initRequest";
	const INIT_RESPONSE_MESSAGE = "initResponse";
	const TARGET_ORIGIN = "*";
	const TIMEOUT_INIT_REQUEST_MESSAGE = 500;
	const TOP_WINDOW_ID = "0";
	const WINDOW_ID_SEPARATOR = ".";
	const TOP_WINDOW = window == top;

	let sessions = new Map(), windowId;

	if (TOP_WINDOW) {
		windowId = TOP_WINDOW_ID;
	}
	addEventListener("message", event => {
		if (typeof event.data == "string" && event.data.startsWith(MESSAGE_PREFIX)) {
			const message = JSON.parse(event.data.substring(MESSAGE_PREFIX.length));
			if (message.method == INIT_REQUEST_MESSAGE) {
				initRequest(message);
			} else if (message.method == INIT_RESPONSE_MESSAGE) {
				const port = event.ports[0];
				port.onmessage = event => initResponse(event.data);
			}
		}
	}, false);
	return {
		getAsync: async options => {
			const sessionId = options.sessionId;
			options = JSON.parse(JSON.stringify(options));
			return new Promise(resolve => {
				sessions.set(sessionId, { frames: [], resolve });
				initRequest({ windowId, sessionId, options });
			});
		},
		getSync: options => {
			const sessionId = options.sessionId;
			options = JSON.parse(JSON.stringify(options));
			sessions.set(sessionId, { frames: [] });
			initRequest({ windowId, sessionId, options });
			return sessions.get(sessionId).frames;
		},
		initResponse
	};

	function initRequest(message) {
		const sessionId = message.sessionId;
		const frameElements = document.querySelectorAll(FRAMES_CSS_SELECTOR);
		if (!TOP_WINDOW) {
			windowId = message.windowId;
			sendInitResponse({ framesData: [getFrameData(document, window, windowId, message.options)], sessionId });
		}
		processFrames(frameElements, message.options, windowId, sessionId);
	}

	function initResponse(message) {
		const windowData = sessions.get(message.sessionId);
		if (windowData) {
			message.framesData.forEach(messageFrameData => {
				let frameData = windowData.frames.find(frameData => messageFrameData.windowId == frameData.windowId);
				if (!frameData) {
					frameData = { windowId: messageFrameData.windowId };
					windowData.frames.push(frameData);
				}
				frameData.content = messageFrameData.content;
				frameData.baseURI = messageFrameData.baseURI;
				frameData.title = messageFrameData.title;
				frameData.stylesheetContents = messageFrameData.stylesheetContents;
				frameData.responsiveImageData = messageFrameData.responsiveImageData;
				frameData.imageData = messageFrameData.imageData;
				frameData.postersData = messageFrameData.postersData;
				frameData.canvasData = messageFrameData.canvasData;
				frameData.fontsData = messageFrameData.fontsData;
				frameData.processed = messageFrameData.processed;
				frameData.timeout = messageFrameData.timeout;
			});
			const remainingFrames = windowData.frames.filter(frameData => !frameData.processed).length;
			if (!remainingFrames) {
				sessions.delete(message.sessionId);
				windowData.frames = windowData.frames.sort((frame1, frame2) => frame2.windowId.split(WINDOW_ID_SEPARATOR).length - frame1.windowId.split(WINDOW_ID_SEPARATOR).length);
				if (windowData.resolve) {
					windowData.resolve(windowData.frames);
				}
			}
		}
	}

	function processFrames(frameElements, options, parentWindowId, sessionId) {
		processFramesAsync(frameElements, options, parentWindowId, sessionId);
		if (frameElements.length) {
			processFramesSync(frameElements, options, parentWindowId, sessionId);
		}
	}

	function processFramesAsync(frameElements, options, parentWindowId, sessionId) {
		const framesData = [];
		frameElements.forEach((frameElement, frameIndex) => {
			const windowId = parentWindowId + WINDOW_ID_SEPARATOR + frameIndex;
			frameElement.setAttribute(docHelper.windowIdAttributeName(options.sessionId), windowId);
			framesData.push({ windowId });
			if (!frameElement.contentDocument) {
				try {
					sendMessage(frameElement.contentWindow, { method: INIT_REQUEST_MESSAGE, windowId, sessionId, options });
				} catch (error) {
					/* ignored */
				}
			}
			timeout.set(() => sendInitResponse({ framesData: [{ windowId, processed: true, timeout: true }], sessionId }), TIMEOUT_INIT_REQUEST_MESSAGE);
		});
		sendInitResponse({ framesData, sessionId });
	}

	function processFramesSync(frameElements, options, parentWindowId, sessionId) {
		const framesData = [];
		frameElements.forEach((frameElement, frameIndex) => {
			const windowId = parentWindowId + WINDOW_ID_SEPARATOR + frameIndex;
			const frameDoc = frameElement.contentDocument;
			if (frameDoc) {
				try {
					processFrames(frameDoc.querySelectorAll(FRAMES_CSS_SELECTOR), options, windowId, sessionId);
					framesData.push(getFrameData(frameDoc, frameElement.contentWindow, windowId, options));
				} catch (error) {
					framesData.push({ windowId, processed: true });
				}
			}
		});
		sendInitResponse({ framesData, sessionId });
	}

	function sendInitResponse(message) {
		message.method = INIT_RESPONSE_MESSAGE;
		try {
			top.frameTree.initResponse(message);
		} catch (error) {
			sendMessage(top, message, true);
		}
	}

	function sendMessage(targetWindow, message, useChannel) {
		if (useChannel) {
			const channel = new MessageChannel();
			targetWindow.postMessage(MESSAGE_PREFIX + JSON.stringify({ method: message.method }), TARGET_ORIGIN, [channel.port2]);
			channel.port1.postMessage(message);
		} else {
			targetWindow.postMessage(MESSAGE_PREFIX + JSON.stringify(message), TARGET_ORIGIN);
		}
	}

	function getFrameData(document, window, windowId, options) {
		const docData = docHelper.preProcessDoc(document, window, options);
		const content = docHelper.serialize(document);
		docHelper.postProcessDoc(document, window, options);
		const baseURI = document.baseURI.split("#")[0];
		return {
			windowId,
			content,
			baseURI,
			title: document.title,
			stylesheetContents: docData.stylesheetContents,
			responsiveImageData: docData.responsiveImageData,
			imageData: docData.imageData,
			postersData: docData.postersData,
			canvasData: docData.canvasData,
			fontsData: docData.fontsData,
			processed: true
		};
	}

})();