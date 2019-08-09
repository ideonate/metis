"use strict";

let port = 0;

let status = 0; /* 0 = loading, 1 = stopped, 2 = launching server, 3 = running, 4 = stopping */

let statustext = ['Loading', 'Dead', 'Launching', 'Live', 'Stopping'];

let uid = '';


function updateUiState() {
    if (status == 0) {
        document.getElementById('connect-button').disabled = true;
        document.getElementById('connect-button').text = 'Loading...';
        document.getElementById('connect-button').style.display = 'none';
    }
    else if (status == 1) {
        document.getElementById('connect-button').disabled = false;
        document.getElementById('connect-button').text = 'Run';
        document.getElementById('connect-button').style.display = 'block';
    } else if (status == 2) {
        document.getElementById('connect-button').text = 'Launching...';
        document.getElementById('connect-button').disabled = true;
    } else if (status == 3) {
        document.getElementById('connect-button').disabled = false;
        document.getElementById('connect-button').text = 'Stop';
    }
    else if (status == 4) {
        document.getElementById('connect-button').disabled = true;
        document.getElementById('connect-button').text = 'Stopping...';
    }
}

function connect() {
    sendObject({cmd: 'start'});
}

function messageResponder(response) {
    console.log(response);
    uid = response.uid;
    port = response.port;
    status = response.status;

    document.getElementById('status').innerHTML = statustext[status];

    document.getElementById('info').innerHTML = '<p>UID: '+uid+'</p><p>Port: '+port+'</p><p>Status: '+status+'</p>';

    let locallogs = document.getElementById('locallogs');
    locallogs.innerHTML = '';
    for (var i=0 ; i<response.locallogs.length ; ++i) {
        locallogs.innerHTML += "<p>" + response.locallogs[i] + "</p>";
    }

    let globallogs = document.getElementById('globallogs');
    globallogs.innerHTML = '';
    for (var i=0 ; i<response.globallogs.length ; ++i) {
        globallogs.innerHTML += "<p>" + response.globallogs[i] + "</p>";
    }

    updateUiState();
};

function sendObject(o) {
    console.log('Sending object');

    o.uid = uid;
    o.status = status;
    o.port = port;

    console.log(o);
    chrome.runtime.sendMessage(o, messageResponder);
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM loaded popup");

    document.getElementById('connect-button').addEventListener(
        'click', connect);

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            messageResponder(request);
        }
    );

    chrome.tabs.query({active: true}, function(tabs){

        if (tabs.length != 1) {
            alert("Multiple active tabs or none");
            console.log(tabs);
        }
        else {
            sendObject({tabid: tabs[0].id});

            updateUiState();
        }
    });

});

