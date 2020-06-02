import "./style.scss";
import { MqttGameConnection } from "./mqttgameconnection";

console.log("Hello World");

const conn = new MqttGameConnection('mqtt.igloo15', 4503, 'chess', 'testGame');

conn.connect();

const result = Math.random();
if(result > 0.5) {
    console.log('readying');
    conn.setStatus('ready');
}
setTimeout(() => {
    console.log('sending message');
    conn.sendMessageToAll('type', {test:32, connected: true}).then((value) => {
        console.log('Got Response From All');
    });
}, 5000);


console.log(`Connecting with ${conn.Id}`);