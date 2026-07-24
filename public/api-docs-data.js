// Single source of truth for the API documentation page; rendered by api-docs.js.
// Add or edit an endpoint here and the page updates - there is no markup to touch.
window.API_DOC_SECTIONS = [
  {
    "title": "WebSocket Commands",
    "description": "Send these as JSON over the WebSocket connection.",
    "items": [
      {
        "title": "Get All Servers",
        "description": "Returns list of all paired servers with their status and smart devices.",
        "request": "// Get list of all paired servers\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"get_servers\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"servers_list\",\r\n  \"data\": {\r\n    \"servers\": {\r\n      \"943118f4-9988-7ddb-9fa1-d38d212fac16\": {\r\n        \"name\": \"HopHop Build server | Main\",\r\n        \"ip\": \"186.105.34.106\",\r\n        \"port\": \"28082\",\r\n        \"status\": \"connected\",\r\n        \"switches\": [\r\n          {\r\n            \"entityId\": \"5774913\",\r\n            \"entityName\": \"Smart Switch\",\r\n            \"entityType\": \"switch\"\r\n          }\r\n        ],\r\n        \"alarms\": [\r\n          {\r\n            \"entityId\": \"5774912\", \r\n            \"entityName\": \"Smart Alarm\",\r\n            \"entityType\": \"alarm\"\r\n          }\r\n        ]\r\n      }\r\n    }\r\n  }\r\n}"
      },
      {
        "title": "Get Server Info",
        "description": "Returns live server information (population, time, etc.).",
        "request": "// Get live server information\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"get_server_info\",\r\n    \"serverId\": \"your-server-id\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"server_info\",\r\n  \"data\": {\r\n    \"name\": \"HopHop Build server | Main\",\r\n    \"ip\": \"186.105.34.106\",\r\n    \"port\": \"28082\",\r\n    \"population\": 0,\r\n    \"maxPopulation\": 100,\r\n    \"time\": \"12:34:56\",\r\n    \"sunrise\": \"06:00:00\",\r\n    \"sunset\": \"18:00:00\"\r\n  }\r\n}"
      },
      {
        "title": "Get Map Data",
        "description": "Returns map image and marker data.",
        "request": "// Get map image and markers\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"get_map_data\",\r\n    \"serverId\": \"your-server-id\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"map_data\",\r\n  \"data\": {\r\n    \"map\": \"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=\",\r\n    \"size\": 1024,\r\n    \"timestamp\": 1640995200,\r\n    \"oceanMargin\": 500,\r\n    \"monuments\": [\r\n      {\r\n        \"token\": \"harbor_display_name\",\r\n        \"x\": 3690.75,\r\n        \"y\": 3907.10\r\n      },\r\n      {\r\n        \"token\": \"airfield_display_name\", \r\n        \"x\": 2843.70,\r\n        \"y\": 3174.95\r\n      },\r\n      {\r\n        \"token\": \"outpost\",\r\n        \"x\": 2929.23,\r\n        \"y\": 622.80\r\n      }\r\n    ],\r\n    \"markers\": {\r\n      \"markers\": [\r\n        {\r\n          \"id\": 563890193,\r\n          \"type\": \"VendingMachine\",\r\n          \"x\": 2958.51,\r\n          \"y\": 640.64,\r\n          \"name\": \"Vendor Farming\",\r\n          \"sellOrders\": [\r\n            {\r\n              \"itemId\": -1488398114,\r\n              \"quantity\": 1,\r\n              \"currencyId\": -932201673,\r\n              \"costPerItem\": 30,\r\n              \"amountInStock\": 10\r\n            }\r\n          ]\r\n        }\r\n      ]\r\n    },\r\n    \"background\": \"#0B3B4A\"\r\n  }\r\n}"
      },
      {
        "title": "Toggle Smart Switch",
        "description": "Toggles a smart switch on/off.",
        "request": "// Toggle a smart switch\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"toggle_switch\",\r\n    \"serverId\": \"your-server-id\",\r\n    \"entityId\": \"entity-id\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"switch_toggled\",\r\n  \"data\": {\r\n    \"entityId\": \"entity-id\",\r\n    \"newState\": true,\r\n    \"message\": \"Switch turned on successfully\"\r\n  }\r\n}"
      },
      {
        "title": "Send Team Message",
        "description": "Sends a message to team chat.",
        "request": "// Send team chat message\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"send_team_message\",\r\n    \"serverId\": \"your-server-id\",\r\n    \"message\": \"Hello team!\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"team_message_sent\",\r\n  \"data\": {\r\n    \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n    \"message\": \"Test message from Rust+ Provider at 2025-10-14T00:24:22.499Z\",\r\n    \"success\": true\r\n  }\r\n}"
      },
      {
        "title": "Get Team Info",
        "description": "Returns team members, leader, and notes.",
        "request": "// Get team information\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"get_team_info\",\r\n    \"serverId\": \"your-server-id\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"team_info\",\r\n  \"data\": {\r\n    \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n    \"teamInfo\": {\r\n      \"seq\": 2,\r\n      \"teamInfo\": {\r\n        \"leaderSteamId\": \"76561198056409776\",\r\n        \"members\": [\r\n          {\r\n            \"steamId\": \"76561198056409776\",\r\n            \"name\": \"nerif.tafu\",\r\n            \"x\": 548.399658203125,\r\n            \"y\": 3884.44482421875,\r\n            \"isOnline\": true,\r\n            \"spawnTime\": 1760374002,\r\n            \"isAlive\": true,\r\n            \"deathTime\": 1760108753\r\n          }\r\n        ],\r\n        \"mapNotes\": [\r\n          {\r\n            \"x\": 907.8348388671875,\r\n            \"y\": 3588.74658203125\r\n          }\r\n        ]\r\n      }\r\n    }\r\n  }\r\n}"
      },
      {
        "title": "Get Entity Info",
        "description": "Returns current status of a smart device.",
        "request": "// Get entity status\r\nwebsocket.send(JSON.stringify({\r\n    \"type\": \"get_entity_info\",\r\n    \"serverId\": \"your-server-id\",\r\n    \"entityId\": \"entity-id\"\r\n}));",
        "responseLabel": "Response",
        "response": "{\r\n  \"type\": \"entity_info\",\r\n  \"data\": {\r\n    \"entityId\": \"entity-id\",\r\n    \"isActive\": true,\r\n    \"available\": true,\r\n    \"lastChecked\": \"2025-01-13T12:34:56.789Z\"\r\n  }\r\n}"
      }
    ]
  },
  {
    "title": "Listening to Broadcasts",
    "description": "Messages the server pushes to the WebSocket without a request.",
    "items": [
      {
        "title": "Team Chat Messages",
        "description": "Receives team chat messages from connected servers.",
        "request": "// Listen for team chat messages\r\nwebsocket.onmessage = function(event) {\r\n    const message = JSON.parse(event.data);\r\n    \r\n    if (message.type === 'team_message') {\r\n        console.log(message.data);\r\n    }\r\n};",
        "responseLabel": "Console Output",
        "response": "{\r\n  \"playerName\": \"nerif.tafu\",\r\n  \"message\": \"Testing 123\",\r\n  \"timestamp\": 1760386074,\r\n  \"serverName\": \"HopHop Build server | Main\"\r\n}"
      },
      {
        "title": "Smart Entity State Changes",
        "description": "Receives notifications when smart switches or alarms change state.",
        "request": "// Listen for entity state changes\r\nwebsocket.onmessage = function(event) {\r\n    const message = JSON.parse(event.data);\r\n    \r\n    if (message.type === 'entity_changed') {\r\n        console.log(message.data);\r\n    }\r\n};",
        "responseLabel": "Console Output",
        "response": "{\r\n  \"entityId\": \"6141035\",\r\n  \"entityName\": \"Smart Switch\",\r\n  \"isActive\": true,\r\n  \"serverName\": \"HopHop Build server | Main\"\r\n}"
      },
      {
        "title": "Server Connection Events",
        "description": "Receives notifications when servers connect or disconnect.",
        "request": "// Listen for server connection changes\r\nwebsocket.onmessage = function(event) {\r\n    const message = JSON.parse(event.data);\r\n    \r\n    if (message.type === 'server_connected') {\r\n        console.log(message.data);\r\n    } else if (message.type === 'server_disconnected') {\r\n        console.log(message.data);\r\n    }\r\n};",
        "responseLabel": "Console Output",
        "response": "// Server Connected\r\n{\r\n  \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n  \"serverName\": \"HopHop Build server | Main\"\r\n}\r\n\r\n// Server Disconnected\r\n{\r\n  \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n  \"serverName\": \"HopHop Build server | Main\"\r\n}\r\n\r\n// Server Connecting\r\n{\r\n  \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n  \"serverName\": \"HopHop Build server | Main\"\r\n}\r\n\r\n// Server Error\r\n{\r\n  \"serverId\": \"df9525f2-4489-b8d9-ff19-b85296ddb39f\",\r\n  \"serverName\": \"HopHop Build server | Main\",\r\n  \"error\": \"Connection timeout\"\r\n}"
      },
      {
        "title": "Live Events Feed",
        "description": "Receives all live events including entity changes, server events, and team chat.",
        "request": "// Listen for all live events\r\nwebsocket.onmessage = function(event) {\r\n    const message = JSON.parse(event.data);\r\n    \r\n    if (message.type === 'live_event') {\r\n        console.log(message.data);\r\n    }\r\n};",
        "responseLabel": "Console Output",
        "response": "// Entity State Changes\r\n{\r\n  \"type\": \"Entity Change\",\r\n  \"message\": \"Entity 6141035 is now ACTIVE on HopHop Build server | Main\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n// Team Chat Messages\r\n{\r\n  \"type\": \"Team Chat\",\r\n  \"message\": \"nerif.tafu: Testing 123\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n// Server Connection Events\r\n{\r\n  \"type\": \"Server Connected\",\r\n  \"message\": \"Server df9525f2-4489-b8d9-ff19-b85296ddb39f connected successfully\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n// Entity Management\r\n{\r\n  \"type\": \"Entity Paired\",\r\n  \"message\": \"Smart Switch paired successfully\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n{\r\n  \"type\": \"Entity Renamed\",\r\n  \"message\": \"Entity 6141035 renamed to 'Main Door Switch'\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n{\r\n  \"type\": \"Entity Deleted\",\r\n  \"message\": \"Entity 6141035 deleted successfully\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n// FCM Registration\r\n{\r\n  \"type\": \"FCM Registration\",\r\n  \"message\": \"FCM tokens registered successfully\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n// Server Data Updates\r\n{\r\n  \"type\": \"Map Markers\",\r\n  \"message\": \"Map markers updated for server\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n{\r\n  \"type\": \"Team Info\",\r\n  \"message\": \"Team information updated for server\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}\r\n\r\n{\r\n  \"type\": \"Server Info\",\r\n  \"message\": \"Server information updated for server\",\r\n  \"timestamp\": \"2025-10-14T00:48:11.117Z\"\r\n}"
      }
    ]
  }
];
