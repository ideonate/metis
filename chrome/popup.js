"use strict";

var isport = false;

function appendMessage(text) {
    document.getElementById('response').innerHTML += "<p>" + text + "</p>";
}

function updateUiState() {
    if (isport) {
        document.getElementById('connect-button').style.display = 'block';
        document.getElementById('input-text').style.display = 'block';
        document.getElementById('send-message-button').style.display = 'block';
    } else {
        document.getElementById('connect-button').style.display = 'block';
        document.getElementById('input-text').style.display = 'none';
        document.getElementById('send-message-button').style.display = 'none';
    }
}

function connect() {
    sendObject({});
}

function sendNativeMessage() {
    let message = {"text": document.getElementById('input-text').value};
    sendObject({msg: message});
}

function sendObject(o) {
    console.log('Sending object');
    console.log(o);
    chrome.runtime.sendMessage(o, function(response) {
        console.log(response);
        document.getElementById('response').innerHTML = '';
        for (var i=0 ; i<response.msgs.length ; ++i) {
            appendMessage(response.msgs[i]);
        }
        isport = response.port;

        updateUiState();
    });
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM loaded popup");
    document.getElementById('connect-button').addEventListener(
        'click', connect);
    document.getElementById('send-message-button').addEventListener(
        'click', sendNativeMessage);
    updateUiState();

});

