"use strict";

const storagekey = 'metisoptions';

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

function saveLocalOptions(virtualenv, homedir, jupyterlab) {
    chrome.storage.local.get([storagekey], function(data) {

        if (data === undefined || !data.hasOwnProperty(storagekey)) {
            data = {[storagekey]: {}};
        }

        function saveListRecent(subdata, key, recentValue){
            if (!subdata.hasOwnProperty(key+'List')) {
                subdata[key] = '';
                subdata[key+'List'] = [];
            }

            let list = subdata[key+'List'];
            let found = false;
            for (let i=0 ; i < list.length ; ++i) {
                if (list[i] == recentValue) {
                    found = true;
                }
            }
            if (!found) {
                list.push(recentValue);
            }

            subdata[key] = recentValue;
        }

        if (data.hasOwnProperty(storagekey)) {
            saveListRecent(data[storagekey], 'virtualenv', virtualenv);
            saveListRecent(data[storagekey], 'homedir', homedir);
            data[storagekey]['jupyterlab'] = jupyterlab;
        }

        chrome.storage.local.set(data);
    });
}

function connect() {
    if (status < 2) {
        let virtualenv = document.getElementById('virtualenv').value;
        let homedir = document.getElementById('homedir').value;
        let jupyterlab = document.getElementById('jupyterlab').checked;

        sendObject({cmd: 'start',
            virtualenv: virtualenv,
            homedir: homedir,
            jupyterlab: jupyterlab});

        status = 2;
        updateUiState();

        saveLocalOptions(virtualenv, homedir, jupyterlab);
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

    if (response.hasOwnProperty('virtualenv')) {
        document.getElementById('virtualenv').value = response.virtualenv;
    }
    if (response.hasOwnProperty('homedir')) {
        document.getElementById('homedir').value = response.homedir;
    }
    if (response.hasOwnProperty('jupyterlab')) {
        document.getElementById('jupyterlab').checked = response.jupyterlab;
    }

    document.getElementById('status').innerHTML = statustext[status];

    document.getElementById('info').innerHTML = '<p>Hostname: '+hostname+'</p><p>Port: '+port+'</p>';



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

    // Load saved options

    chrome.storage.local.get([storagekey], function(data) {

        function extractListDefault(subdata, key, defaultValue){
            let list = [defaultValue];
            if (subdata.hasOwnProperty(key+'List')) {
                list = subdata[key + 'List'];
            }

            let elt = document.getElementById(key+'List');

            for (let i=0 ; i < list.length ; ++i) {
                let option = document.createElement('option');
                option.value = list[i];
                elt.appendChild(option);
            }

            if (subdata.hasOwnProperty(key)) {
                let textelt = document.getElementById(key);
                textelt.value = subdata[key];
            }
        }

        if (data === undefined) {
            data = {};
        }
        if (!data.hasOwnProperty(storagekey)) {
            data[storagekey] = {};
        }

        extractListDefault(data[storagekey], 'virtualenv', '');
        extractListDefault(data[storagekey], 'homedir', '~');

        if (data[storagekey].hasOwnProperty('jupyterlab')) {
            document.getElementById('jupyterlab').checked = data[storagekey]['jupyterlab'];
        }
    });

    // Tie up Launch/Stop button and listener to receive Jupyter data

    document.getElementById('connect-button').addEventListener(
        'click', connect);

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            messageResponder(request);
        }
    );


    // Init query to metis.js based on current tab, to be received by above handler

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){

        if (tabs.length > 1) {
            alert("Multiple active tabs");
        }
        else {
            sendObject({tabid: tabs[0].id, taburl: tabs[0].url});

            updateUiState();
        }
    });

});

