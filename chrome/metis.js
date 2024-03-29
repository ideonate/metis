"use strict";

let tabmap = new Map();

let jservermap = new Map();

let servermap = new Map();

let uidcounter = 1;

let globallogs = [];

let nativeport = null;

function appendMessage(text) {
	globallogs.push(text);
}

function sendNativeMessage(serverobj, msg) {
	msg.uid = serverobj.uid;
	nativeport.postMessage(msg);

	serverobj.locallogs.push("Sent message: " + JSON.stringify(msg));

	if (msg.cmd == 'start') {
		serverobj.status = 2;
		sendForPopup(serverobj);
	}
}

function sendForPopup(serverobj) {
	chrome.runtime.sendMessage({uid: serverobj.uid,
		hostname: serverobj.hostname,
		port: serverobj.port,
		virtualenv: serverobj.virtualenv,
		homedir: serverobj.homedir,
		jupyterlab: serverobj.jupyterlab,
		server_info: serverobj.server_info,
		status: serverobj.status,
		locallogs: serverobj.locallogs,
		stderrlogs: serverobj.stderrlogs,
		globallogs: globallogs
	});
}

function onNativeMessage(msg) {
	if (msg.uid) {
		let serverobj = servermap.get(msg.uid);

		if (msg.status) {
			serverobj.status = msg.status;
			if (serverobj.status == 4) {
				// Stopped so remove this from maps TODO
			}
		}
		if (msg.server_info) {
			/* This is the first time we know server is started */
			serverobj.server_info = msg.server_info;
			serverobj.hostname = msg.server_info.hostname;
			serverobj.port = msg.server_info.port;

			jservermap.set(serverobj.hostname+':'+serverobj.port, msg.uid);

			if (serverobj.requesting_tabid) {
				let url = msg.server_info.url;
				/*if (serverobj.jupyterlab) {
					url += 'lab/';
				}*/
				if (msg.server_info.token) {
					url += '?token='+msg.server_info.token;
				}
				chrome.tabs.update(serverobj.requesting_tabid, {url: url})
				tabmap.delete(serverobj.requesting_tabid); // Let tab stand on its own feet now - identified by hostname:port only
			}
		}
		if (msg.stderrmsg) {
			serverobj.stderrlogs.push(msg.stderrmsg);
		}
		else {
			serverobj.locallogs.push('Received Msg: ' + JSON.stringify(msg))
		}
		sendForPopup(serverobj);
	}
	else {
		appendMessage("Received global message: <b>" + JSON.stringify(msg) + "</b>");
	}
}

function onDisconnected() {
	appendMessage("Disconnected: " + chrome.runtime.lastError.message);
	nativeport = null;
}

function connect() {
	if (nativeport == null) {
		var hostName = "com.ideonate.metis";
		appendMessage("Connecting to native messaging host <b>" + hostName + "</b>")
		nativeport = chrome.runtime.connectNative(hostName);
		nativeport.onMessage.addListener(onNativeMessage);
		nativeport.onDisconnect.addListener(onDisconnected);
	}
}

function blank_serverobj(serverobj, uid, defaults) {
	serverobj.uid = uid;
	serverobj.hostname = '';
	serverobj.port = 0;
	serverobj.server_info = {};
	serverobj.locallogs = ['Starting with uid: '+uid];
	serverobj.stderrlogs = [];
	serverobj.status = 1; // Stopped

	serverobj.virtualenv = '';
	serverobj.homedir = '';
	serverobj.jupyterlab = true;

	if (defaults !== undefined) {
		for (let property in defaults) {
			if (defaults.hasOwnProperty(property)) {
				serverobj[property] = defaults[property];
			}
		}
	}

	return serverobj;
}

async function start() {

	//chrome.storage.local.clear(); // For testing

	connect();

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			if (!sender.tab) { // from the extension (not a content script)
				let tabid = null;
				let serverobj = {};
				let uid = request.uid;

				if (request.tabid) {
					tabid = request.tabid;
					if (request.taburl) {
						let taburl = new URL(request.taburl);
						let hostnameport = taburl.hostname + ':' + taburl.port;
						if (jservermap.has(hostnameport)) {
							uid = jservermap.get(hostnameport);
						}
					} else if (tabmap.has(request.tabid)) {
						uid = tabmap.get(request.tabid);
					}
				}

				let retval = {};

				if (!uid) {
					uid = uidcounter++;

					serverobj = blank_serverobj({}, uid, {virtualenv: request.virtualenv, homedir: request.homedir, jupyterlab: request.jupyterlab});

					serverobj.requesting_tabid = tabid;

					servermap.set(uid, serverobj);

					tabmap.set(tabid, uid);
				}
				else {
					serverobj = servermap.get(uid);
				}

				// Start or stop server?
				if (request.cmd) {
					serverobj.status = (request.status + 1) % 5;
					if (request.status == 1 && request.cmd == 'start') {

						// If this uid was running before, we're going to get a new hostname:port, so remove from map cache
						if (serverobj.hostname != '' && serverobj.port != 0) {
							let hostnameport = serverobj.hostname + ':' + serverobj.port;
							if (jservermap.has(hostnameport)) {
								jservermap.delete(hostnameport);
							}
							serverobj.requesting_tabid = tabid; // Come back to this tab
							tabmap.set(tabid, uid);

							serverobj = blank_serverobj(serverobj, uid); // Reset since original must have been stopped
						}

						serverobj.virtualenv = request.virtualenv;
						serverobj.homedir = request.homedir;
						serverobj.jupyterlab = request.jupyterlab;

						sendNativeMessage(serverobj, {cmd: request.cmd,
							virtualenv: serverobj.virtualenv,
							homedir: serverobj.homedir,
							jupyterlab: serverobj.jupyterlab});
					}
					else if (request.status == 3 && request.cmd == 'stop') {
						sendNativeMessage(serverobj, {cmd: request.cmd,
							server_info: serverobj.server_info,
							virtualenv: serverobj.virtualenv,
							homedir: serverobj.homedir,
							jupyterlab: serverobj.jupyterlab});
					}
				}

				sendResponse({uid: uid,
					hostname: serverobj.hostname,
					port: serverobj.port,
					server_info: serverobj.server_info,
					status: serverobj.status,
					virtualenv: serverobj.virtualenv,
					homedir: serverobj.homedir,
					jupyterlab: serverobj.jupyterlab,
					locallogs: serverobj.locallogs,
					stderrlogs: serverobj.stderrlogs,
					globallogs: globallogs
				});
			}

		});

	chrome.browserAction.setPopup({'popup':'main.html'});
}

start();
