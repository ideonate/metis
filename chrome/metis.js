"use strict";

function popupCallback() {
	console.log("popupCallback");
}


function tabUpdated(tabId, changeInfo, tab) {

	console.log("tabUpdated: "+tabId);
}

function iconClicked(tab) {
	console.log("iconClicked: "+tab.id);
}

async function start() {

	chrome.tabs.onUpdated.addListener(tabUpdated);

	chrome.browserAction.setPopup({'popup':'main.html'}, popupCallback);
	//chrome.browserAction.onClicked.addListener(popupCallback);
}

start();
