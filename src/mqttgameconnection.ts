import { RawConnection, MqttMessage } from '@igloo15/mqtt-browser-lib';
import { customAlphabet, urlAlphabet } from 'nanoid';
import { ClientPing, ResponseMessage, RequestAllMessage, RequestMessage, ResponseWaiter } from './types';
import { MessageFactory } from './messagefactory';

const nanoid = customAlphabet(urlAlphabet, 10);
const clientTimeout = 3000;
const pingCycle = 2000;
const clientCheckInterval = Math.floor(clientTimeout * 2 / pingCycle);

export class MqttGameConnection {
    private _conn: RawConnection;
    private _factory: MessageFactory;
    private _id = nanoid();
    private _status = 'connected';
    private _gameName: string;
    private _gameId: string;

    private _intervalId: any;
    private _pingTopic: string;
    private _messageAllTopic: string;
    private _messageTopic: string;
    private _clients: Map<string, ClientPing> = new Map<string, ClientPing>();

    constructor(host: string, port: number, gameName: string, gameId: string) {
        this._conn = new RawConnection(host, port, this._id, {protocolVersion: 5});
        this._factory = new MessageFactory(this._id, gameName, gameId);
        this._gameName = gameName;
        this._gameId = gameId;
        this._pingTopic = `mqtt/game/${this._gameName}/${this._gameId}/ping`;
        this._messageAllTopic = `mqtt/game/${this._gameName}/${this._gameId}/message`;
        this._messageTopic = `mqtt/game/${this._gameName}/${this._gameId}/message/${this._id}`;
    }

    get Id() {
        return this._id;
    }

    async connect() {
        const result = await this._conn.connectAsync();
        this._conn.events.on('onMessage', this.processMessage)
        this._conn.subscribe(this._pingTopic, {qos: 1, nl: true});
        this._conn.subscribe(this._messageAllTopic, {qos: 1, nl: true});
        this._conn.subscribe(this._messageTopic, {qos: 1, nl: true});
        this.startPinging();
        return result;
    }

    async disconnect() {
        const result = await this._conn.disconnectAsync();
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
        return result;
    }

    publish(topic: string, message: any) {
        const messageString = JSON.stringify(message);
        this._conn.publish(topic, messageString);
    }

    setStatus(newStatus: string) {
        this._status = newStatus;
    }

    sendMessageToClient<T>(receiverId: string, type: string, message: T) {
        const request = this._factory.createRequest(message, type, receiverId);
        const topic = this._factory.getRequestTopic(receiverId);
        return this.sendMessage(topic, request);
    }

    sendMessageToAll<T>(type: string, message: T) {
        const request = this._factory.createAllRequest(message, type);
        return this.sendMessage(this._messageAllTopic, request);
    }

    private sendMessage<T>(topic: string, message: T) {
        return new Promise<boolean>((resolve, reject) => {
            this._conn.publishJson(topic, message, { qos: 1 }, () => {
                resolve(true);
            });
        });
    }

    private startPinging() {
        if (!this._intervalId) {
            let index = 0;
            this._intervalId = setInterval(() => {
                this._conn.publishJson(this._pingTopic, this._factory.createPing(this._status));
                index++;
                if (index % clientCheckInterval) {
                    this.updateClients();
                    index = 0;
                }
            }, pingCycle);
        }
    }


    private processMessage = (message: MqttMessage) => {
        if (message.topic === this._pingTopic) {
            const pingMsg = message.getJsonObject<ClientPing>();
            this._clients.set(pingMsg.id, pingMsg);
        }

        if (message.topic === this._messageAllTopic) {
            const requestAllMessage = message.getJsonObject<RequestAllMessage>();
            console.log(`got a request ${requestAllMessage.senderId} : ${requestAllMessage.id}`);
        }

        if (message.topic === this._messageTopic) {
            const requestMessage = message.getJsonObject<RequestMessage>();
        }
    }

    private updateClients() {
        const keysToRemove: string[] = [];
        const currentTime = this.getTime();
        this._clients.forEach((value) => {
            const timeSinceLastUpdate = currentTime - value.lastUpdate;
            if (timeSinceLastUpdate > clientTimeout) {
                keysToRemove.push(value.id);
            }
        });

        keysToRemove.forEach((value) => {
            this._clients.delete(value);
        });
    }

    private getTime() {
        return Date.now();
    }
}