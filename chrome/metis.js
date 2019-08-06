"use strict";

var msgs = [];

var port = null;
var getKeys = function(obj){
	var keys = [];
	for(var key in obj){
		keys.push(key);
	}
	return keys;
}
function appendMessage(text) {
	msgs.push(text);
}

function sendNativeMessage(msg) {
	port.postMessage(msg);
	appendMessage("Sent message: <b>" + JSON.stringify(msg) + "</b>");
}
function onNativeMessage(msg) {
	appendMessage("Received message: <b>" + JSON.stringify(msg) + "</b>");
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
				if (request.msg) {
					sendNativeMessage(request.msg);
				}
				sendResponse({port: port != null,
					msgs: msgs
				});
		});

	chrome.browserAction.setPopup({'popup':'main.html'}, popupCallback);
	//chrome.browserAction.onClicked.addListener(popupCallback);
}

start();
