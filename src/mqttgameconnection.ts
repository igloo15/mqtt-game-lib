import { RawConnection, MqttMessage } from '@igloo15/mqtt-browser-lib';
import { customAlphabet, urlAlphabet } from 'nanoid';
import { ClientPing, ResponseMessage, RequestAllMessage, RequestMessage, ResponseWaiter } from './types';
import { MessageFactory } from './messagefactory';

const nanoid = customAlphabet(urlAlphabet, 10);
const clientTimeout = 3000;
const pingCycle = 2000;

export class MqttGameConnection {
    private _conn: RawConnection;
    private _factory: MessageFactory;
    private _id = nanoid();
    private _status = 'connected';
    private _gameName: string;
    private _gameId: string;

    private _intervalId: any;
    private _pingTopic: string;
    private _requestTopic: string;
    private _requestClientTopic: string;
    private _responseTopic: string;
    private _clients: Map<string, ClientPing> = new Map<string, ClientPing>();
    private _requests: Map<string, ResponseWaiter> = new Map<string, ResponseWaiter>();

    constructor(host: string, port: number, gameName: string, gameId: string) {
        this._conn = new RawConnection(host, port, this._id, {protocolVersion: 5});
        this._factory = new MessageFactory(this._id, gameName, gameId);
        this._gameName = gameName;
        this._gameId = gameId;
        this._pingTopic = `mqtt/game/${this._gameName}/${this._gameId}/ping`;
        this._requestTopic = `mqtt/game/${this._gameName}/${this._gameId}/request`;
        this._requestClientTopic = `mqtt/game/${this._gameName}/${this._gameId}/request/${this._id}`;
        this._responseTopic = `mqtt/game/${this._gameName}/${this._gameId}/response`;
    }

    get Id() {
        return this._id;
    }

    async connect() {
        const result = await this._conn.connectAsync();
        this._conn.events.on('onMessage', this.processMessage)
        this._conn.subscribe(this._pingTopic, {qos: 0, nl: true});
        this._conn.subscribe(this._responseTopic, {qos: 0, nl: true});
        this._conn.subscribe(this._requestTopic, {qos: 0, nl: true});
        this._conn.subscribe(this._requestClientTopic, {qos: 0, nl: true});
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
        return new Promise((resolve, reject) => {
            const request = this._factory.createRequest(message, type, receiverId);
            const waiter = this._factory.createWaiter([receiverId], resolve, false);
            this._requests.set(request.id, waiter);
            this._conn.publishJson(this._factory.getRequestTopic(receiverId), request);
        });
    }

    sendMessageToAll<T>(type: string, message: T) {
        return new Promise((resolve, reject) => {
            const request = this._factory.createAllRequest(message, type);
            const receivers = Array.from(this._clients.keys());
            if(receivers.length === 0) {
                console.warn('No Receivers Found');
                reject();
                return;
            }
            const waiter = this._factory.createWaiter(Array.from(this._clients.keys()), resolve, true);
            this._requests.set(request.id, waiter);
            this._conn.publishJson(this._requestTopic, request);
        });
    }

    private startPinging() {
        if (!this._intervalId) {
            let index = 0;
            this._intervalId = setInterval(() => {
                this._conn.publishJson(this._pingTopic, this._factory.createPing(this._status));
                index++;
                if (index % 3) {
                    this.updateClients();
                    index = 0;
                }
            }, pingCycle);
        }
    }

    private sendResponse(msgId: string) {
        console.log(`sending response ${msgId}`);
        this._conn.publishJson(this._responseTopic, this._factory.createResponse(msgId));
    }

    private processMessage = (message: MqttMessage) => {
        if (message.topic === this._pingTopic) {
            const pingMsg = message.getJsonObject<ClientPing>();
            this._clients.set(pingMsg.id, pingMsg);
        }

        if (message.topic === this._requestTopic) {
            const requestAllMessage = message.getJsonObject<RequestAllMessage>();
            console.log(`got a request ${requestAllMessage.senderId} : ${requestAllMessage.id}`);
            this.sendResponse(requestAllMessage.id);
        }

        if (message.topic === this._requestClientTopic) {
            const requestMessage = message.getJsonObject<RequestMessage>();
            this.sendResponse(requestMessage.id);
        }

        if (message.topic === this._responseTopic) {
            const responseMessage = message.getJsonObject<ResponseMessage>();
            console.log(`Got Response ${responseMessage.receiverId} : ${responseMessage.msgId}`);
            this.checkResponse(responseMessage);
        }
    }

    private checkResponse(responseMessage: ResponseMessage) {
        if (responseMessage.receiverId === this._id) {
            return;
        }
        
        const waiter = this._requests.get(responseMessage.msgId);
        if (waiter) {
            if (waiter.allResponse) {
                waiter.responses.push(responseMessage.receiverId);
                if (waiter.receivers.length <= waiter.responses.length) {
                    this._requests.delete(responseMessage.msgId);
                    console.log(waiter.responses);
                    waiter.finish();
                }
            } else {
                this._requests.delete(responseMessage.msgId);
                waiter.finish();
            }
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