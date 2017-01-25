/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add 
natural language support to a bot. 
For a complete walkthrough of creating this type of bot see the article at
http://docs.botframework.com/builder/node/guides/understanding-natural-language/
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var https = require("https");

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
.matches('None', (session, args) => {
    session.send('Searching for \'%s\'', session.message.text);
    session.send('\'%s\' not found', session.message.text);
})
.matches('Welcome', (session, args) => {
    session.send('¡Holla! How can I help you?', session.message.text);
})
.matches('Services', (session, args) => {
    https.get('https://chhs.data.ca.gov/resource/v6p5-i3t9.json', (res) => {
        var rawData = "";
        res.on('data', (d) => {
            rawData += d;
        });
        res.on('done', (d) => {
            try {
              let parsedData = JSON.parse(rawData);
              session.send(JSON.stringify(parsedData));
            } catch (e) {
              session.send(res.statusCode);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
})
.matches('WicLocations', (session, args) => {
    session.beginDialog('getLocation');
})
.onDefault((session) => {
    session.send('Searching for \'%s\'', session.message.text);
    session.send('\'%s\' not found', session.message.text);
});

bot.dialog('/', intents);

// Get all WIC vendors in a zip code
bot.dialog('getLocation', [
    function (session, args) {
        builder.Prompts.text(session, "Please enter your zip code.");
    },
    function (session, result) {
        var zip = result.response;
        session.send(`Searching for WIC vendors in ${zip}`);
        https.get(`https://chhs.data.ca.gov/resource/v6p5-i3t9.json?zip_code=${zip}`, (res) => {
            var rawData = "";
            res.on('data', (d) => {
                rawData += d;
            });
            res.on('end', () => {
              let parsedData = JSON.parse(rawData);
              if (parsedData.length === 0) {
                session.send(`There are no vendors that accept WIC in ${zip}`);
              } else {
                let x = "";
                parsedData.forEach((it) => {
                  x += `    ${it.vendor} ${it.address} ${it.city}    `;
                });
                session.send(x);
              }
            });
        }).on('error', (e) => {
            session.send(e);
        });
    }
]);

// Get all Open Data Apis
// bot.dialog('allApis', [
//     function (session, args) {
//         builder.Prompts.text(session, "Please enter the name of the API you want to find more about.");
//     },
//     function (session, result) {
//         var name = result.response;
//         https.get(`https://chhs.data.ca.gov/resource/2x4a-6af9.json?name=${name}`, (res) => {
//             var rawData = "";
//             res.on('data', (d) => {
//                 rawData += d;
//             });
//             res.on('end', () => {
//               let parsedData = JSON.parse(rawData);
//               if (parsedData.length === 0) {
//                 session.send(`No API found with the name ${name} (must match exactly)`);
//               } else {
//                 let x = "";
//                 parsedData.forEach((it) => {
//                   x += `${it.description}`;
//                 });
//                 session.send(x);
//               }
//             });
//         }).on('error', (e) => {
//             session.send(e);
//         });
//     }
// ]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}

