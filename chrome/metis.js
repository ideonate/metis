"use strict";

let tabmap = new Map();

let servermap = new Map();

let uidcounter = 1;

let globallogs = [];

let port = null;

function appendMessage(text) {
	globallogs.push(text);
}

function sendNativeMessage(serverobj, msg) {
	msg.uid = serverobj.uid;
	port.postMessage(msg);
	appendMessage("Sent message: <b>" + JSON.stringify(msg) + "</b>");

	if (msg.cmd == 'start') {
		serverobj.status = 2;
		serverobj.locallogs.push('Sent native start command');
		sendForPopup(serverobj);
	}
}

function sendForPopup(serverobj) {
	chrome.runtime.sendMessage({uid: serverobj.uid,
		port: serverobj.port,
		status: serverobj.status,
		locallogs: serverobj.locallogs,
		globallogs: globallogs
	});
}

function onNativeMessage(msg) {
	appendMessage("Received message: <b>" + JSON.stringify(msg) + "</b>");

	if (msg.uid) {
		let serverobj = servermap.get(msg.uid);
		if (msg.status) {
			serverobj.status = msg.status;
		}
		if (msg.port) {
			serverobj.port = msg.port;
		}
		sendForPopup(serverobj);
	}
}
function onDisconnected() {
	appendMessage("Disconnected: " + chrome.runtime.lastError.message);
	port = null;
}
function connect() {
	if (port == null) {
		var hostName = "com.ideonate.metis";
		appendMessage("Connecting to native messaging host <b>" + hostName + "</b>")
		port = chrome.runtime.connectNative(hostName);
		port.onMessage.addListener(onNativeMessage);
		port.onDisconnect.addListener(onDisconnected);
	}
}

function popupCallback() {
	console.log("popupCallback");
}

function tabUpdated(tabId, changeInfo, tab) {
	console.log("tabUpdated: "+tabId);
}

async function start() {

	chrome.tabs.onUpdated.addListener(tabUpdated);

	connect();

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			console.log(sender.tab ?
				"from a content script:" + sender.tab.url :
				"from the extension");
			if (!sender.tab) {

				let serverobj = {};
				let uid = request.uid;

				if (request.tabid) {
					if (tabmap.has(request.tabid)) {
						uid = tabmap.get(request.tabid);
					}
				}

				let retval = {};

				if (!uid) {
					uid = uidcounter++;
					serverobj.uid = uid;
					serverobj.port = 0;
					serverobj.locallogs = ['Starting with uid: '+uid];
					serverobj.status = 1; // Stopped
					servermap.set(uid, serverobj);

					if (request.tabid) {
						tabmap.set(request.tabid, uid);
					}
				}
				else {
					serverobj = servermap.get(uid);
				}

				sendResponse({uid: uid,
					port: serverobj.port,
					status: serverobj.status,
					locallogs: serverobj.locallogs,
					globallogs: globallogs
				});

				// Start or stop server?
				if (request.cmd) {
					serverobj.status = (request.status + 1) % 5;
					if (request.status == 1 || request.status == 3) {
						sendNativeMessage(serverobj, {cmd:'start'});
					}
				}
			}

		});

	chrome.browserAction.setPopup({'popup':'main.html'}, popupCallback);
	//chrome.browserAction.onClicked.addListener(popupCallback);
}

start();
