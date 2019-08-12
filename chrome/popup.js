"use strict";

let port = 0;

let hostname = '';

let server_info = null;

let status = 0; /* 0 = loading, 1 = stopped, 2 = launching server, 3 = running, 4 = stopping */

let statustext = ['Loading', 'Stopped', 'Launching', 'Live', 'Stopping'];
let buttondisabled = [true, false, true, false, true];
let buttontext = ['Loading', 'Launch', 'Launching', 'Stop', 'Stopping'];

let uid = '';

function updateUiState() {
    document.getElementById('connect-button').disabled = buttondisabled[status];
    document.getElementById('connect-button').innerHTML = buttontext[status];
    document.getElementById('connect-button').style.display = 'block';

    // document.getElementById('virtualenv').style.display = status == 1 ? 'block' : 'none';
    // document.getElementById('homedir').style.display = status == 1 ? 'block' : 'none';

    var prelaunchelts = document.getElementsByClassName("prelaunchonly");
    for (var i=0 ; i < prelaunchelts.length ; ++i) {
        prelaunchelts[i].disabled = status != 1;
    }

}

function connect() {
    if (status < 2) {
        sendObject({cmd: 'start',
            virtualenv: document.getElementById('virtualenv').value,
            homedir: document.getElementById('homedir').value,
            jupyterlab: document.getElementById('jupyterlab').checked});

        status = 2;
        updateUiState();
    }
    else {
        // Stop
        sendObject({cmd: 'stop'});
        status = 4;
        updateUiState();
    }
}

function messageResponder(response) {
    uid = response.uid;
    port = response.port;
    hostname = response.hostname;
    status = response.status;

    let virtualenv = response.virtualenv || "";
    let homedir = response.homedir || "";
    let jupyterlab = true;
    if (response.hasOwnProperty('jupyterlab')) {
        jupyterlab = response.jupyterlab;
    }

    document.getElementById('status').innerHTML = statustext[status];

    document.getElementById('info').innerHTML = '<p>Hostname: '+hostname+'</p><p>Port: '+port+'</p>';

    document.getElementById('virtualenv').value = virtualenv;
    document.getElementById('homedir').value = homedir;
    document.getElementById('jupyterlab').checked = jupyterlab;

    let locallogs = document.getElementById('locallogs');
    locallogs.innerHTML = '';
    for (var i=0 ; i<response.locallogs.length ; ++i) {
        locallogs.innerHTML += "<p>" + response.locallogs[i] + "</p>";
    }

    let stderrlogs = document.getElementById('stderrlogs');
    stderrlogs.innerHTML = '';
    for (var i=0 ; i<response.stderrlogs.length ; ++i) {
        stderrlogs.innerHTML += "<p>" + response.stderrlogs[i] + "</p>";
    }

    let globallogs = document.getElementById('globallogs');
    globallogs.innerHTML = '';
    for (var i=0 ; i<response.globallogs.length ; ++i) {
        globallogs.innerHTML += "<p>" + response.globallogs[i] + "</p>";
    }

    updateUiState();
};

function sendObject(o) {
    o.uid = uid;
    o.status = status;
    o.hostname = hostname;
    o.post = port;

    chrome.runtime.sendMessage(o, messageResponder);
}

document.addEventListener('DOMContentLoaded', function () {

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
            sendObject({tabid: tabs[0].id, taburl: tabs[0].url});

            updateUiState();
        }
    });

});

